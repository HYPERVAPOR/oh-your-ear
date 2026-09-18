package api

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/middleware"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// Server implements the generated OpenAPI server interface.
// Request budgets per client IP. Sending mail and guessing codes are the two
// endpoints worth throttling; the per-address cooldown on codes only stops
// repetition against one address.
const (
	codeRequestsPerHour = 10
	loginAttemptsPer15m = 30
)

type Server struct {
	cfg          config.Config
	auth         *services.AuthService
	practice     *services.PracticeService
	mailer       services.Mailer
	codeLimiter  *middleware.RateLimiter
	loginLimiter *middleware.RateLimiter
}

// NewServer creates a new API server.
func NewServer(cfg config.Config, authSvc *services.AuthService, practiceSvc *services.PracticeService, mailer services.Mailer) *Server {
	return &Server{
		cfg:          cfg,
		auth:         authSvc,
		practice:     practiceSvc,
		mailer:       mailer,
		codeLimiter:  middleware.NewRateLimiter(codeRequestsPerHour, time.Hour),
		loginLimiter: middleware.NewRateLimiter(loginAttemptsPer15m, 15*time.Minute),
	}
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
	if !s.codeLimiter.RateLimit(c) {
		return
	}

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
		s.deliverEmailCode(c, string(body.Email), code)
	}
}

// deliverEmailCode sends the code through the configured mailer. A delivery
// failure still answers 204: the caller must not be able to tell whether an
// address exists, and the code can be requested again after the cooldown.
func (s *Server) deliverEmailCode(c *gin.Context, email, code string) {
	subject := "Oh Your Ear verification code"
	body := fmt.Sprintf("Your verification code is %s. It expires in %s.", code, services.EmailCodeTTL)

	if err := s.mailer.Send(c.Request.Context(), email, subject, body); err != nil {
		log.Printf("failed to deliver verification code to %s via %s: %v", email, s.mailer.Driver(), err)
	}
	c.Status(http.StatusNoContent)
}

// loginWithEmail verifies a code and signs the user in, registering on first use.
func (s *Server) loginWithEmail(c *gin.Context) {
	if !s.loginLimiter.RateLimit(c) {
		return
	}

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
	userID, ok := s.requireUser(c)
	if !ok {
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

// Logout handles POST /auth/logout. The refresh token is revoked server-side,
// so clearing the cookie is not the only thing standing between a stolen token
// and a new session.
func (s *Server) Logout(c *gin.Context) {
	if token, err := c.Cookie(auth.RefreshTokenCookieName); err == nil {
		if claims, err := auth.ParseToken(token, s.cfg.JWTSecret); err == nil && claims.ID != "" {
			expiresAt := time.Now().UTC().Add(24 * time.Hour)
			if claims.ExpiresAt != nil {
				expiresAt = claims.ExpiresAt.Time
			}
			if err := s.auth.RevokeToken(c.Request.Context(), claims.ID, expiresAt); err != nil {
				log.Printf("failed to revoke refresh token: %v", err)
			}
		}
	}

	c.SetCookie(auth.RefreshTokenCookieName, "", -1, "/", "", false, true)
	c.Status(http.StatusNoContent)
}
