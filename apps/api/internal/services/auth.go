package services

import (
	"context"
	"fmt"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthService handles authentication-related operations.
type AuthService struct {
	pool *pgxpool.Pool
}

// NewAuthService creates a new AuthService.
func NewAuthService(pool *pgxpool.Pool) *AuthService {
	return &AuthService{pool: pool}
}

// UpsertGoogleUser creates or updates a user from Google profile data.
func (s *AuthService) UpsertGoogleUser(ctx context.Context, googleID, email, name, avatarURL string) (*models.User, error) {
	query := `
		INSERT INTO users (email, name, avatar_url, google_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (google_id) DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			avatar_url = EXCLUDED.avatar_url,
			updated_at = NOW()
		RETURNING id, email, name, avatar_url, created_at, updated_at
	`
	return s.scanUser(ctx, query, email, name, avatarURL, googleID)
}

// UpsertMockUser creates or updates the development mock user by email.
func (s *AuthService) UpsertMockUser(ctx context.Context, email, name string) (*models.User, error) {
	query := `
		INSERT INTO users (email, name)
		VALUES ($1, $2)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name,
			updated_at = NOW()
		RETURNING id, email, name, avatar_url, created_at, updated_at
	`
	return s.scanUser(ctx, query, email, name)
}

// GetUserByID fetches a user by ID.
func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	query := `SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = $1`
	return s.scanUser(ctx, query, id)
}

func (s *AuthService) scanUser(ctx context.Context, query string, args ...interface{}) (*models.User, error) {
	row := s.pool.QueryRow(ctx, query, args...)
	var user models.User
	var avatarURL *string
	err := row.Scan(&user.ID, &user.Email, &user.Name, &avatarURL, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to scan user: %w", err)
	}
	user.AvatarURL = avatarURL
	return &user, nil
}
