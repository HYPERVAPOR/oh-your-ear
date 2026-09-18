package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"
	// Embedded so APP_TIMEZONE resolves even in images without tzdata.
	_ "time/tzdata"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/api"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/db"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
	"github.com/gin-gonic/gin"
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

	loc, err := time.LoadLocation(cfg.AppTimezone)
	if err != nil {
		return fmt.Errorf("invalid APP_TIMEZONE %q: %w", cfg.AppTimezone, err)
	}
	practiceSvc := services.NewPracticeService(pool, loc)

	server := api.NewServer(cfg, authSvc, practiceSvc)

	r := gin.Default()

	// OAuth, token refresh, and the dev-only mock login are not in the OpenAPI
	// contract yet, so they are registered by hand.
	registerAuthRoutes(r, cfg, server, authSvc)

	// The route prefix must match `servers` in openapi.yaml, which the web client
	// (src/api/client.ts) and nginx both assume.
	api.RegisterHandlersWithOptions(r, server, api.GinServerOptions{BaseURL: "/api/v1"})

	log.Printf("server listening on %s", cfg.ServerAddr)
	if err := r.Run(cfg.ServerAddr); err != nil {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

func registerAuthRoutes(r *gin.Engine, cfg config.Config, server *api.Server, authSvc *services.AuthService) {
	googleCfg := auth.NewGoogleOAuthConfig(cfg.GoogleClientID, cfg.GoogleSecret, cfg.GoogleRedirect)
	ctx := context.Background()

	r.GET("/api/v1/auth/google", func(c *gin.Context) {
		if cfg.GoogleClientID == "" {
			c.JSON(http.StatusNotImplemented, api.ErrorResponse{Error: "google oauth not configured"})
			return
		}

		state, err := auth.NewOAuthState()
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to start oauth flow"})
			return
		}
		c.SetCookie(auth.OAuthStateCookieName, state, int(auth.OAuthStateTTL.Seconds()), "/", "", false, true)
		c.Redirect(http.StatusTemporaryRedirect, googleCfg.AuthCodeURL(state))
	})

	r.GET("/api/v1/auth/google/callback", func(c *gin.Context) {
		if cfg.GoogleClientID == "" {
			c.JSON(http.StatusNotImplemented, api.ErrorResponse{Error: "google oauth not configured"})
			return
		}

		state, _ := c.Cookie(auth.OAuthStateCookieName)
		if code := c.Query("code"); code == "" || state == "" || c.Query("state") != state {
			c.JSON(http.StatusBadRequest, api.ErrorResponse{Error: "invalid oauth callback"})
			return
		}
		c.SetCookie(auth.OAuthStateCookieName, "", -1, "/", "", false, true)

		token, err := googleCfg.Exchange(ctx, c.Query("code"))
		if err != nil {
			c.JSON(http.StatusBadRequest, api.ErrorResponse{Error: "failed to exchange code"})
			return
		}

		gUser, err := auth.FetchGoogleUser(ctx, token)
		if err != nil {
			c.JSON(http.StatusBadRequest, api.ErrorResponse{Error: "failed to fetch google user"})
			return
		}

		user, err := authSvc.UpsertGoogleUser(c.Request.Context(), gUser.ID, gUser.Email, gUser.Name, gUser.Picture)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to save user"})
			return
		}

		accessToken, refreshToken, err := server.IssueTokens(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to generate tokens"})
			return
		}

		server.SetRefreshCookie(c, refreshToken)
		c.Redirect(http.StatusTemporaryRedirect, cfg.FrontendURL+"/#access_token="+url.QueryEscape(accessToken))
	})

	r.POST("/api/v1/auth/mock", func(c *gin.Context) {
		user, err := authSvc.UpsertMockUser(c.Request.Context(), cfg.MockAuthEmail, cfg.MockAuthName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to create mock user"})
			return
		}

		server.RespondWithSession(c, user)
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

		accessTTL, _ := server.TokenTTLs()
		accessToken, err := auth.GenerateAccessToken(claims.UserID, claims.Email, cfg.JWTSecret, accessTTL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, api.ErrorResponse{Error: "failed to generate access token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"accessToken": accessToken})
	})
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
