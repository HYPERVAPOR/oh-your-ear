package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// EmailCodeTTL is how long a verification code stays valid.
	EmailCodeTTL = 10 * time.Minute
	// EmailCodeCooldown throttles how often a code can be requested per address.
	EmailCodeCooldown = 60 * time.Second
	// EmailCodeMaxAttempts locks a code before its TTL, blunting brute force on 6 digits.
	EmailCodeMaxAttempts = 5
)

var (
	// ErrCodeCooldown means a code was sent to this address too recently.
	ErrCodeCooldown = errors.New("code was sent recently")
	// ErrInvalidCode covers an unknown, expired, or mismatched code.
	ErrInvalidCode = errors.New("invalid or expired code")
	// ErrTooManyAttempts means the code was locked after too many wrong guesses.
	ErrTooManyAttempts = errors.New("too many attempts")
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

// RevokeToken blocks a refresh token until it would have expired anyway, and
// drops rows whose tokens are already dead.
func (s *AuthService) RevokeToken(ctx context.Context, jti string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING`,
		jti, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to revoke token: %w", err)
	}

	if _, err := s.pool.Exec(ctx, `DELETE FROM revoked_tokens WHERE expires_at < NOW()`); err != nil {
		return fmt.Errorf("failed to prune revoked tokens: %w", err)
	}
	return nil
}

// IsTokenRevoked reports whether a refresh token was revoked by a logout.
func (s *AuthService) IsTokenRevoked(ctx context.Context, jti string) (bool, error) {
	var revoked bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW())`, jti,
	).Scan(&revoked)
	if err != nil {
		return false, fmt.Errorf("failed to check token revocation: %w", err)
	}
	return revoked, nil
}

// RequestEmailCode stores a fresh code for the address and returns it so the caller can deliver it.
func (s *AuthService) RequestEmailCode(ctx context.Context, email string) (string, error) {
	code, err := newEmailCode()
	if err != nil {
		return "", err
	}

	// The DO UPDATE ... WHERE guard makes the cooldown atomic: a row is returned
	// only when the previous code is old enough to be replaced.
	query := `
		INSERT INTO email_codes (email, code_hash, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (email) DO UPDATE SET
			code_hash = EXCLUDED.code_hash,
			expires_at = EXCLUDED.expires_at,
			attempts = 0,
			created_at = NOW()
		WHERE email_codes.created_at < $4
		RETURNING email
	`

	now := time.Now().UTC()
	var stored string
	err = s.pool.QueryRow(ctx, query, email, hashEmailCode(email, code), now.Add(EmailCodeTTL), now.Add(-EmailCodeCooldown)).Scan(&stored)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrCodeCooldown
	}
	if err != nil {
		return "", fmt.Errorf("failed to store email code: %w", err)
	}

	return code, nil
}

// ConsumeEmailCode validates a code and deletes it on success.
func (s *AuthService) ConsumeEmailCode(ctx context.Context, email, code string) error {
	var storedHash string
	var expiresAt time.Time
	var attempts int

	err := s.pool.QueryRow(ctx,
		`SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = $1`, email,
	).Scan(&storedHash, &expiresAt, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidCode
	}
	if err != nil {
		return fmt.Errorf("failed to read email code: %w", err)
	}

	switch checkEmailCode(email, storedHash, code, expiresAt, attempts, time.Now().UTC()) {
	case codeOK:
		if _, err := s.pool.Exec(ctx, `DELETE FROM email_codes WHERE email = $1`, email); err != nil {
			return fmt.Errorf("failed to consume email code: %w", err)
		}
		return nil
	case codeLocked:
		return ErrTooManyAttempts
	case codeExpired:
		_, _ = s.pool.Exec(ctx, `DELETE FROM email_codes WHERE email = $1`, email)
		return ErrInvalidCode
	default:
		attempts++
		_, err := s.pool.Exec(ctx, `UPDATE email_codes SET attempts = $2 WHERE email = $1`, email, attempts)
		if err != nil {
			return fmt.Errorf("failed to record failed attempt: %w", err)
		}
		if attempts >= EmailCodeMaxAttempts {
			return ErrTooManyAttempts
		}
		return ErrInvalidCode
	}
}

type codeCheck int

const (
	codeOK codeCheck = iota
	codeMismatch
	codeExpired
	codeLocked
)

// checkEmailCode is the pure decision table behind ConsumeEmailCode.
func checkEmailCode(email, storedHash, provided string, expiresAt time.Time, attempts int, now time.Time) codeCheck {
	if attempts >= EmailCodeMaxAttempts {
		return codeLocked
	}
	if !now.Before(expiresAt) {
		return codeExpired
	}
	if hashEmailCode(email, provided) != storedHash {
		return codeMismatch
	}
	return codeOK
}

func newEmailCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("failed to generate code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashEmailCode(email, code string) string {
	sum := sha256.Sum256([]byte(email + ":" + code))
	return hex.EncodeToString(sum[:])
}

// UpsertEmailUser returns the user for an address, creating it on first login.
func (s *AuthService) UpsertEmailUser(ctx context.Context, email string, name *string) (*models.User, error) {
	query := `
		INSERT INTO users (email, name)
		VALUES ($1, $2)
		ON CONFLICT (email) DO UPDATE SET
			name = COALESCE(EXCLUDED.name, users.name),
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
