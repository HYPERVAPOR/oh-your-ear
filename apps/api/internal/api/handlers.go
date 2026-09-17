package api

import (
	"net/http"
	"time"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
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
	var body RegisterJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	_ = body
	c.JSON(http.StatusOK, AuthResponse{
		AccessToken: "stub-access-token",
		User: UserResponse{
			Id:        uuid.New(),
			Email:     body.Email,
			Name:      body.Name,
			AvatarUrl: nil,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
	})
}

// Login handles POST /auth/login.
func (s *Server) Login(c *gin.Context) {
	var body LoginJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}

	_ = body
	c.JSON(http.StatusOK, AuthResponse{
		AccessToken: "stub-access-token",
		User: UserResponse{
			Id:        uuid.New(),
			Email:     body.Email,
			Name:      nil,
			AvatarUrl: nil,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
	})
}

// GetMe handles GET /auth/me.
func (s *Server) GetMe(c *gin.Context) {
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

// Logout handles POST /auth/logout.
func (s *Server) Logout(c *gin.Context) {
	c.SetCookie(auth.RefreshTokenCookieName, "", -1, "/", "", false, true)
	c.Status(http.StatusNoContent)
}
