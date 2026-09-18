package api

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/middleware"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// Server implements the generated OpenAPI server interface.
type Server struct {
	cfg  config.Config
	auth *services.AuthService
}

// NewServer creates a new API server.
func NewServer(cfg config.Config, authSvc *services.AuthService) *Server {
	return &Server{cfg: cfg, auth: authSvc}
}

// GetHealth handles GET /health.
func (s *Server) GetHealth(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{Status: "ok"})
}

// Register handles POST /auth/register.
func (s *Server) Register(c *gin.Context) {
	s.loginWithEmail(c)
}

// Login handles POST /auth/login.
func (s *Server) Login(c *gin.Context) {
	s.loginWithEmail(c)
}

// RequestEmailCode handles POST /auth/code.
func (s *Server) RequestEmailCode(c *gin.Context) {
	var body EmailCodeRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	code, err := s.auth.RequestEmailCode(c.Request.Context(), string(body.Email))
	switch {
	case errors.Is(err, services.ErrCodeCooldown):
		c.JSON(http.StatusTooManyRequests, ErrorResponse{Error: "code already sent"})
	case err != nil:
		log.Printf("failed to create email code: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to send code"})
	default:
		// ponytail: delivery is a log line, no SMTP configured. Wire a real sender
		// with the production deployment work (M12.3).
		log.Printf("[auth] verification code for %s: %s (valid %s)", body.Email, code, services.EmailCodeTTL)
		c.Status(http.StatusNoContent)
	}
}

// loginWithEmail verifies a code and signs the user in, registering on first use.
func (s *Server) loginWithEmail(c *gin.Context) {
	var body EmailAuthRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	err := s.auth.ConsumeEmailCode(c.Request.Context(), string(body.Email), body.Code)
	switch {
	case errors.Is(err, services.ErrTooManyAttempts):
		c.JSON(http.StatusTooManyRequests, ErrorResponse{Error: "too many attempts"})
		return
	case errors.Is(err, services.ErrInvalidCode):
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid or expired code"})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to verify code"})
		return
	}

	user, err := s.auth.UpsertEmailUser(c.Request.Context(), string(body.Email), body.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to save user"})
		return
	}

	s.RespondWithSession(c, user)
}

// GetMe handles GET /auth/me.
func (s *Server) GetMe(c *gin.Context) {
	if !middleware.Auth(c, s.cfg.JWTSecret) {
		return
	}

	claims, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	tokenClaims := claims.(*auth.TokenClaims)
	userID, err := uuid.Parse(tokenClaims.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid user"})
		return
	}

	user, err := s.auth.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "user not found"})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		Id:        user.ID,
		Email:     openapi_types.Email(user.Email),
		Name:      user.Name,
		AvatarUrl: user.AvatarURL,
		CreatedAt: user.CreatedAt.UTC(),
		UpdatedAt: user.UpdatedAt.UTC(),
	})
}

// IssueTokens signs a fresh access/refresh pair for a user.
func (s *Server) IssueTokens(user *models.User) (string, string, error) {
	accessTTL, refreshTTL := s.TokenTTLs()

	accessToken, err := auth.GenerateAccessToken(user.ID.String(), user.Email, s.cfg.JWTSecret, accessTTL)
	if err != nil {
		return "", "", err
	}
	refreshToken, err := auth.GenerateRefreshToken(user.ID.String(), user.Email, s.cfg.JWTSecret, refreshTTL)
	if err != nil {
		return "", "", err
	}
	return accessToken, refreshToken, nil
}

// SetRefreshCookie stores the refresh token in an http-only cookie.
func (s *Server) SetRefreshCookie(c *gin.Context, refreshToken string) {
	_, refreshTTL := s.TokenTTLs()
	c.SetCookie(auth.RefreshTokenCookieName, refreshToken, int(refreshTTL.Seconds()), "/", "", false, true)
}

// RespondWithSession signs the user in and writes the generated AuthResponse.
func (s *Server) RespondWithSession(c *gin.Context, user *models.User) {
	accessToken, refreshToken, err := s.IssueTokens(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to generate tokens"})
		return
	}

	s.SetRefreshCookie(c, refreshToken)
	c.JSON(http.StatusOK, AuthResponse{
		AccessToken: accessToken,
		User: UserResponse{
			Id:        user.ID,
			Email:     openapi_types.Email(user.Email),
			Name:      user.Name,
			AvatarUrl: user.AvatarURL,
			CreatedAt: user.CreatedAt.UTC(),
			UpdatedAt: user.UpdatedAt.UTC(),
		},
	})
}

// TokenTTLs resolves the configured access and refresh token lifetimes.
func (s *Server) TokenTTLs() (time.Duration, time.Duration) {
	return parseTTL(s.cfg.AccessTokenTTL, 15*time.Minute), parseTTL(s.cfg.RefreshTokenTTL, 7*24*time.Hour)
}
func parseTTL(value string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return d
}

// Logout handles POST /auth/logout.
func (s *Server) Logout(c *gin.Context) {
	c.SetCookie(auth.RefreshTokenCookieName, "", -1, "/", "", false, true)
	c.Status(http.StatusNoContent)
}
