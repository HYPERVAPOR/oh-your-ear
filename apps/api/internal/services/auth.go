package services

import (
	"context"
	"fmt"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/google/uuid"
)

// AuthService handles authentication-related operations.
type AuthService struct{}

// NewAuthService creates a new AuthService.
func NewAuthService() *AuthService {
	return &AuthService{}
}

// GetUserByID is a placeholder for fetching a user.
func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	return nil, fmt.Errorf("not implemented")
}
