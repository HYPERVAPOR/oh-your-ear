package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/api"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/db"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/middleware"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func run() error {
	cfg := config.Load()

	pool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer pool.Close()

	ctx := context.Background()
	if err := db.Migrate(ctx, pool); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	authSvc := services.NewAuthService(pool)

	r := gin.Default()

	// Custom auth routes (not in the OpenAPI contract yet).
	registerAuthRoutes(r, cfg, authSvc)

	server := api.NewServer(cfg, authSvc)
	// The route prefix must match `servers` in openapi.yaml, which the web client
	// (src/api/client.ts) and nginx both assume.
	api.RegisterHandlersWithOptions(r, server, api.GinServerOptions{BaseURL: "/api/v1"})

	log.Printf("server listening on %s", cfg.ServerAddr)
	if err := r.Run(cfg.ServerAddr); err != nil {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

func registerAuthRoutes(r *gin.Engine, cfg config.Config, authSvc *services.AuthService) {
	googleCfg := auth.NewGoogleOAuthConfig(cfg.GoogleClientID, cfg.GoogleSecret, cfg.GoogleRedirect)

	accessTTL := parseDuration(cfg.AccessTokenTTL, 15*time.Minute)
	refreshTTL := parseDuration(cfg.RefreshTokenTTL, 7*24*time.Hour)

	ctx := context.Background()

	issueTokens := func(c *gin.Context, user *models.User) (string, string, error) {
		accessToken, err := auth.GenerateAccessToken(user.ID.String(), user.Email, cfg.JWTSecret, accessTTL)
		if err != nil {
			return "", "", err
		}
		refreshToken, err := auth.GenerateRefreshToken(user.ID.String(), user.Email, cfg.JWTSecret, refreshTTL)
		if err != nil {
			return "", "", err
		}
		return accessToken, refreshToken, nil
	}

	setCookiesAndRespond := func(c *gin.Context, user *models.User) {
		accessToken, refreshToken, err := issueTokens(c, user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to generate tokens"})
			return
		}
		c.SetCookie(auth.RefreshTokenCookieName, refreshToken, int(refreshTTL.Seconds()), "/", "", false, true)
		c.JSON(http.StatusOK, api.AuthResponse{
			AccessToken: accessToken,
			User: api.UserResponse{
				Id:        user.ID,
				Email:     openapi_types.Email(user.Email),
				Name:      user.Name,
				AvatarUrl: user.AvatarURL,
				CreatedAt: user.CreatedAt.UTC(),
				UpdatedAt: user.UpdatedAt.UTC(),
			},
		})
	}

	r.GET("/api/v1/auth/google", func(c *gin.Context) {
		if cfg.GoogleClientID == "" {
			c.JSON(http.StatusNotImplemented, api.ErrorResponse{Error: "google oauth not configured"})
			return
		}
		state := "TODO" // Add CSRF state in a real implementation.
		c.Redirect(http.StatusTemporaryRedirect, googleCfg.AuthCodeURL(state))
	})

	r.GET("/api/v1/auth/google/callback", func(c *gin.Context) {
		if cfg.GoogleClientID == "" {
			c.JSON(http.StatusNotImplemented, api.ErrorResponse{Error: "google oauth not configured"})
			return
		}

		code := c.Query("code")
		if code == "" {
			c.JSON(http.StatusBadRequest, api.ErrorResponse{Error: "missing code"})
			return
		}

		token, err := googleCfg.Exchange(ctx, code)
		if err != nil {
			c.JSON(http.StatusBadRequest, api.ErrorResponse{Error: "failed to exchange code"})
			return
		}

		gUser, err := auth.FetchGoogleUser(ctx, token)
		if err != nil {
			c.JSON(http.StatusBadRequest, api.ErrorResponse{Error: "failed to fetch google user"})
			return
		}

		user, err := authSvc.UpsertGoogleUser(ctx, gUser.ID, gUser.Email, gUser.Name, gUser.Picture)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to save user"})
			return
		}

		accessToken, refreshToken, err := issueTokens(c, user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to generate tokens"})
			return
		}

		c.SetCookie(auth.RefreshTokenCookieName, refreshToken, int(refreshTTL.Seconds()), "/", "", false, true)
		frontendURL := "http://localhost:5173"
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/#access_token="+accessToken)
	})

	r.POST("/api/v1/auth/mock", func(c *gin.Context) {
		user, err := authSvc.UpsertMockUser(ctx, cfg.MockAuthEmail, cfg.MockAuthName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to create mock user"})
			return
		}

		setCookiesAndRespond(c, user)
	})

	r.POST("/api/v1/auth/refresh", func(c *gin.Context) {
		refreshToken, err := c.Cookie(auth.RefreshTokenCookieName)
		if err != nil {
			c.JSON(http.StatusUnauthorized, api.ErrorResponse{Error: "missing refresh token"})
			return
		}

		claims, err := auth.ParseToken(refreshToken, cfg.JWTSecret)
		if err != nil || claims.Type != "refresh" {
			c.JSON(http.StatusUnauthorized, api.ErrorResponse{Error: "invalid refresh token"})
			return
		}

		accessToken, err := auth.GenerateAccessToken(claims.UserID, claims.Email, cfg.JWTSecret, accessTTL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to generate access token"})
			return
		}

		c.JSON(http.StatusOK, api.AuthResponse{AccessToken: accessToken})
	})

	// Apply JWT middleware to generated /auth/me and future protected routes.
	r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
}

func parseDuration(value string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return d
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
