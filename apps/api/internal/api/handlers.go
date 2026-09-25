package api

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
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
	// Password attempts are budgeted per *address* rather than per IP: five guesses at one
	// account are five guesses whatever address they come from, and an attacker with
	// addresses to spare would walk straight past an IP-keyed budget.
	passwordAttemptsPer15m = 5
)

type Server struct {
	cfg             config.Config
	auth            *services.AuthService
	practice        *services.PracticeService
	mailer          services.Mailer
	codeLimiter     *middleware.RateLimiter
	loginLimiter    *middleware.RateLimiter
	passwordLimiter *middleware.RateLimiter
}

// NewServer creates a new API server.
func NewServer(cfg config.Config, authSvc *services.AuthService, practiceSvc *services.PracticeService, mailer services.Mailer) *Server {
	return &Server{
		cfg:             cfg,
		auth:            authSvc,
		practice:        practiceSvc,
		mailer:          mailer,
		codeLimiter:     middleware.NewRateLimiter(codeRequestsPerHour, time.Hour),
		loginLimiter:    middleware.NewRateLimiter(loginAttemptsPer15m, 15*time.Minute),
		passwordLimiter: middleware.NewRateLimiter(passwordAttemptsPer15m, 15*time.Minute),
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

// loginWithEmail verifies a code and signs the user in, registering on first use. The same
// endpoint takes a password instead, when the account has one: the two answers are identical,
// so the client only swaps the request body.
func (s *Server) loginWithEmail(c *gin.Context) {
	if !s.loginLimiter.RateLimit(c) {
		return
	}

	var body EmailAuthRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	if body.Password != nil && body.Code == nil {
		s.loginWithPassword(c, string(body.Email), *body.Password)
		return
	}
	if body.Code == nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "a code or a password is required"})
		return
	}

	err := s.auth.ConsumeEmailCode(c.Request.Context(), string(body.Email), *body.Code)
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

// loginWithPassword is the other half of POST /auth/login: an address and a password.
//
// One error answers an unknown address, an account with no password, and a wrong password —
// the caller must not be able to tell them apart, which is also why the service spends the
// time of a real check even when there is nothing to check.
func (s *Server) loginWithPassword(c *gin.Context, email, password string) {
	// Only failures spend the budget (Allow, then Hit below), the way the code path counts
	// wrong guesses rather than logins: otherwise someone who signs in five times in a
	// quarter of an hour is locked out of their own account, and an attacker can lock them
	// out on purpose by burning the budget first. A verification code still works while
	// this budget is spent, which is also how a forgotten password gets reset.
	if !s.passwordLimiter.Allow(email) {
		c.JSON(http.StatusTooManyRequests, ErrorResponse{Error: "too many attempts"})
		return
	}

	user, err := s.auth.LoginWithPassword(c.Request.Context(), email, password)
	switch {
	case errors.Is(err, services.ErrBadCredentials):
		s.passwordLimiter.Hit(email)
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid email or password"})
		return
	case err != nil:
		log.Printf("failed to log in with password: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to log in"})
		return
	}

	s.RespondWithSession(c, user)
}

// SetMyPassword handles PUT /me/password: setting a first password, or replacing one.
func (s *Server) SetMyPassword(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	var body SetPasswordRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	err := s.auth.SetPassword(c.Request.Context(), userID, body.CurrentPassword, body.NewPassword)
	switch {
	case errors.Is(err, services.ErrPasswordTooShort), errors.Is(err, services.ErrPasswordTooLong):
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	case errors.Is(err, services.ErrWrongPassword):
		// Not 401: the caller *is* authenticated, they just do not know their own password.
		c.JSON(http.StatusForbidden, ErrorResponse{Error: "current password is wrong"})
	case err != nil:
		log.Printf("failed to set password: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to save password"})
	default:
		c.Status(http.StatusNoContent)
	}
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

	c.JSON(http.StatusOK, s.userResponse(c, *user))
}

// userResponse is the account as the client sees it. The avatar URL is the picture this
// reader uploaded when there is one — versioned by its timestamp, so a replacement is not
// served from a cache — otherwise whatever the sign-in provider gave us, otherwise empty,
// and the client draws its generated pixel avatar.
func (s *Server) userResponse(c *gin.Context, user models.User) UserResponse {
	avatar := user.AvatarURL
	if updatedAt, ok := s.auth.AvatarUpdatedAt(c.Request.Context(), user.ID); ok {
		url := fmt.Sprintf("/api/v1/me/avatar?v=%d", updatedAt.Unix())
		avatar = &url
	}

	return UserResponse{
		Id:          user.ID,
		Email:       openapi_types.Email(user.Email),
		Name:        user.Name,
		AvatarUrl:   avatar,
		HasPassword: user.HasPassword,
		CreatedAt:   user.CreatedAt.UTC(),
		UpdatedAt:   user.UpdatedAt.UTC(),
	}
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
	secure := strings.HasPrefix(s.cfg.FrontendURL, "https://")
	c.SetCookie(auth.RefreshTokenCookieName, refreshToken, int(refreshTTL.Seconds()), "/", "", secure, true)
}

// RespondWithSession signs the user in and writes the generated AuthResponse.
func (s *Server) RespondWithSession(c *gin.Context, user *models.User) {
	accessToken, refreshToken, err := s.IssueTokens(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to generate tokens"})
		return
	}

	s.SetRefreshCookie(c, refreshToken)
	// Through the same builder as GET /me: an uploaded avatar must be in the session the
	// client receives, not only in the next read of the account.
	c.JSON(http.StatusOK, AuthResponse{
		AccessToken: accessToken,
		User:        s.userResponse(c, *user),
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

	c.SetCookie(auth.RefreshTokenCookieName, "", -1, "/", "", strings.HasPrefix(s.cfg.FrontendURL, "https://"), true)
	c.Status(http.StatusNoContent)
}
