package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Server implements the generated OpenAPI server interface.
type Server struct{}

// NewServer creates a new API server.
func NewServer() *Server {
	return &Server{}
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
	c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
}

// Logout handles POST /auth/logout.
func (s *Server) Logout(c *gin.Context) {
	c.Status(http.StatusNoContent)
}
