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
	"unicode/utf8"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	// EmailCodeTTL is how long a verification code stays valid.
	EmailCodeTTL = 10 * time.Minute
	// EmailCodeCooldown throttles how often a code can be requested per address.
	EmailCodeCooldown = 60 * time.Second
	// EmailCodeMaxAttempts locks a code before its TTL, blunting brute force on 6 digits.
	EmailCodeMaxAttempts = 5
	// PasswordMinLength is counted in characters, not bytes, so a Chinese passphrase is not
	// held to a different bar than an English one. No composition rules and no forced
	// rotation: length is the part that helps, and the rest makes people pick worse
	// passwords and write them down (NIST SP 800-63B).
	PasswordMinLength = 8
	// PasswordMaxBytes is bcrypt's own limit. It ignores everything past 72 bytes rather
	// than failing, so longer input is rejected instead of silently truncated — otherwise
	// two different passwords could open the same account.
	PasswordMaxBytes = 72
)

// bcryptCost is above the library's default of 10. Raising it stays possible: the cost is
// stored inside every hash, so old hashes keep verifying after a bump.
const bcryptCost = 12

var (
	// ErrCodeCooldown means a code was sent to this address too recently.
	ErrCodeCooldown = errors.New("code was sent recently")
	// ErrInvalidCode covers an unknown, expired, or mismatched code.
	ErrInvalidCode = errors.New("invalid or expired code")
	// ErrTooManyAttempts means the code was locked after too many wrong guesses.
	ErrTooManyAttempts = errors.New("too many attempts")
	// ErrPasswordTooShort and ErrPasswordTooLong are refusals of a *new* password.
	ErrPasswordTooShort = errors.New("password too short")
	ErrPasswordTooLong  = errors.New("password too long")
	// ErrBadCredentials covers an unknown address and a wrong password alike: the caller
	// must not be able to tell which of the two it was.
	ErrBadCredentials = errors.New("bad credentials")
	// ErrWrongPassword means the account has a password and the one supplied is not it.
	ErrWrongPassword = errors.New("wrong password")
)

// AuthService handles authentication-related operations.
type AuthService struct {
	pool *pgxpool.Pool
}

// The two queries that return a whole user. They have to agree on the column list, and
// `has_password` is computed in SQL on purpose: the hash itself never reaches a Go struct
// that might find its way into a response.
const (
	userColumns      = `id, email, name, avatar_url, (password_hash IS NOT NULL), created_at, updated_at`
	userByIDQuery    = `SELECT ` + userColumns + ` FROM users WHERE id = $1`
	userByEmailQuery = `SELECT ` + userColumns + ` FROM users WHERE email = $1`
)

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
		RETURNING ` + userColumns + `
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
		RETURNING ` + userColumns + `
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
		RETURNING ` + userColumns + `
	`
	return s.scanUser(ctx, query, email, name)
}

// LoginWithPassword signs in with an address and a password.
//
// An address that does not exist, an account with no password yet, and a wrong password are
// all ErrBadCredentials. On an unknown address the submitted password is hashed and thrown
// away, so the answer takes as long as a real check — otherwise response time alone would
// tell an attacker which addresses are registered.
func (s *AuthService) LoginWithPassword(ctx context.Context, email, password string) (*models.User, error) {
	var hash *string
	err := s.pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE email = $1`, email).Scan(&hash)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		if _, hashErr := hashPassword(password); hashErr != nil {
			return nil, fmt.Errorf("failed to hash password: %w", hashErr)
		}
		return nil, ErrBadCredentials
	case err != nil:
		return nil, fmt.Errorf("failed to load password: %w", err)
	case hash == nil || !verifyPassword(*hash, password):
		return nil, ErrBadCredentials
	}

	return s.scanUser(ctx, userByEmailQuery, email)
}

// SetPassword stores a password for a signed-in account.
//
// The current password is required whenever there is one to check: a session can be a stolen
// cookie, but the old password is knowledge only its owner has. Setting a *first* password
// needs no old one — that session came from a verification code, which already proved the
// address, and this is the one moment that proof is worth something.
func (s *AuthService) SetPassword(ctx context.Context, userID uuid.UUID, currentPassword *string, newPassword string) error {
	if err := validatePassword(newPassword); err != nil {
		return err
	}

	var hash *string
	if err := s.pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&hash); err != nil {
		return fmt.Errorf("failed to load password: %w", err)
	}
	if hash != nil && (currentPassword == nil || !verifyPassword(*hash, *currentPassword)) {
		return ErrWrongPassword
	}

	newHash, err := hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, userID, newHash); err != nil {
		return fmt.Errorf("failed to store password: %w", err)
	}
	return nil
}

// validatePassword is the whole policy: a floor on characters, a ceiling on bytes.
func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < PasswordMinLength {
		return ErrPasswordTooShort
	}
	if len(password) > PasswordMaxBytes {
		return ErrPasswordTooLong
	}
	return nil
}

// hashPassword and verifyPassword are the only two places bcrypt is touched.
func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func verifyPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// GetUserByID fetches a user by ID.
func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	return s.scanUser(ctx, userByIDQuery, id)
}

func (s *AuthService) scanUser(ctx context.Context, query string, args ...interface{}) (*models.User, error) {
	row := s.pool.QueryRow(ctx, query, args...)
	var user models.User
	var avatarURL *string
	err := row.Scan(&user.ID, &user.Email, &user.Name, &avatarURL, &user.HasPassword, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to scan user: %w", err)
	}
	user.AvatarURL = avatarURL
	return &user, nil
}
