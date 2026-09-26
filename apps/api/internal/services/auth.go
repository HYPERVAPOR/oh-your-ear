package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
	// NameMaxRunes is a label's length, not a bio's: room for a full name in any script,
	// short enough that it cannot push the account card it sits in out of shape. The same
	// number is the `maxLength` in openapi.yaml.
	NameMaxRunes = 50
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
	// ErrUserNotFound is a lookup that matched no row.
	ErrUserNotFound = errors.New("user not found")
	// ErrEmailLinked means the address already belongs to an account whose Google identity
	// is a different one.
	ErrEmailLinked = errors.New("email already linked to another account")
	// ErrNameEmpty and ErrNameTooLong are refusals of a *new* display name. Empty is
	// refused rather than stored as a blank one: an account with no name has a null one,
	// and the client draws its own placeholder for that — two ways to say "no name" would
	// be one too many.
	ErrNameEmpty   = errors.New("name is empty")
	ErrNameTooLong = errors.New("name is too long")
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
	userByGoogleID   = `SELECT ` + userColumns + ` FROM users WHERE google_id = $1`
	// Only an account that has no Google identity yet can be claimed by one.
	userByEmailUnlinked = `SELECT ` + userColumns + ` FROM users WHERE email = $1 AND google_id IS NULL`
)

// NewAuthService creates a new AuthService.
func NewAuthService(pool *pgxpool.Pool) *AuthService {
	return &AuthService{pool: pool}
}

// UpsertGoogleUser signs in a Google account.
//
// **An address is one identity, and a sign-in method is a key to it** (PRD 5.10), so this
// walks three cases in order and stops at the first that has a row:
//
//  1. this Google account has signed in before → that account, profile refreshed;
//  2. the address belongs to an account with no Google identity → attach this one. Google
//     says the address is verified and the original sign-in proved the same mailbox, so it
//     is the same person arriving through a second door;
//  3. the address belongs to a *different* Google account → refuse. Re-linking would hand
//     one person's progress to another login.
//
// Only a verified Google address reaches case 2; the caller checks that.
func (s *AuthService) UpsertGoogleUser(ctx context.Context, googleID, email, name, avatarURL string) (*models.User, error) {
	if user, found, err := s.findUser(ctx, userByGoogleID, googleID); err != nil {
		return nil, err
	} else if found {
		return s.refreshProviderProfile(ctx, user.ID, email, name, avatarURL)
	}

	if user, found, err := s.findUser(ctx, userByEmailUnlinked, email); err != nil {
		return nil, err
	} else if found {
		if _, err := s.pool.Exec(ctx,
			`UPDATE users SET google_id = $2, name = COALESCE(NULLIF($3, ''), name),
			 avatar_url = COALESCE($4, avatar_url), updated_at = NOW() WHERE id = $1`,
			user.ID, googleID, name, nullableText(avatarURL),
		); err != nil {
			return nil, fmt.Errorf("failed to link google account: %w", err)
		}
		return s.scanUser(ctx, userByIDQuery, user.ID)
	}

	if _, found, err := s.findUser(ctx, userByEmailQuery, email); err != nil {
		return nil, err
	} else if found {
		return nil, ErrEmailLinked
	}

	// Two callbacks can race for a brand new account; the loser reads the winner's row
	// rather than failing on a unique constraint.
	user, found, err := s.findUser(ctx,
		`INSERT INTO users (email, name, avatar_url, google_id)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (google_id) DO NOTHING
		 RETURNING `+userColumns,
		email, name, nullableText(avatarURL), googleID,
	)
	if err != nil {
		return nil, err
	}
	if found {
		return user, nil
	}
	return s.scanUser(ctx, userByGoogleID, googleID)
}

// refreshProviderProfile updates the fields the sign-in provider owns, leaving everything
// the reader owns alone: a provider returning no name is not a reason to forget one.
func (s *AuthService) refreshProviderProfile(ctx context.Context, userID uuid.UUID, email, name, avatarURL string) (*models.User, error) {
	if _, err := s.pool.Exec(ctx,
		`UPDATE users SET email = $2, name = COALESCE(NULLIF($3, ''), name),
		 avatar_url = COALESCE($4, avatar_url), updated_at = NOW() WHERE id = $1`,
		userID, email, name, nullableText(avatarURL),
	); err != nil {
		// The provider's address can have moved onto another account. That is the same
		// conflict as case 3 below, not a server fault.
		if isUniqueViolation(err) {
			return nil, ErrEmailLinked
		}
		return nil, fmt.Errorf("failed to refresh provider profile: %w", err)
	}
	return s.scanUser(ctx, userByIDQuery, userID)
}

// nullableText keeps an empty string out of a nullable column: the statements above use
// COALESCE to fall back to the stored value, and ” is not "nothing".
func nullableText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
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

// EmailRegistered answers whether an address already has an account.
//
// This is the one place on the sign-in surface that tells the caller whether an address is
// known: everywhere else answers the same way for both cases (see RequestEmailCode and
// LoginWithPassword). It exists so the sign-up screen can send someone who already has an
// account to the sign-in screen instead of through a code they do not need. The price is an
// oracle for "who has an account here", which is why the endpoint shares the code throttle —
// asking has to stay expensive.
func (s *AuthService) EmailRegistered(ctx context.Context, email string) (bool, error) {
	var registered bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)`, email).Scan(&registered)
	if err != nil {
		return false, fmt.Errorf("failed to look up email: %w", err)
	}
	return registered, nil
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

// ResetPassword sets a new password for an address proven by an email code.
//
// The code takes the place of the current password, which is the whole point of the path:
// it exists for the reader who no longer has one. Everything else about a password still
// holds — the same length floor, and the code is spent, so this works once. The password is
// checked before the code is spent, so a rejected password does not cost a new code.
//
// An address with no account gets one, exactly as a first code login does, which keeps this
// from being a way to ask whether an address is registered.
func (s *AuthService) ResetPassword(ctx context.Context, email, code, newPassword string) (*models.User, error) {
	if err := validatePassword(newPassword); err != nil {
		return nil, err
	}
	if err := s.ConsumeEmailCode(ctx, email, code); err != nil {
		return nil, err
	}

	user, err := s.UpsertEmailUser(ctx, email, nil)
	if err != nil {
		return nil, err
	}

	newHash, err := hashPassword(newPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, user.ID, newHash); err != nil {
		return nil, fmt.Errorf("failed to store password: %w", err)
	}

	return user, nil
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

// SetName stores the display name. Google fills one in for its accounts; everyone else starts
// without one, and this is how they get one without making a new account.
//
// The row is written and then read back through the same path /auth/me uses, so what the
// client gets is the account as it is, not a second hand-built copy of it that can drift.
func (s *AuthService) SetName(ctx context.Context, userID uuid.UUID, name string) (*models.User, error) {
	name, err := validateName(name)
	if err != nil {
		return nil, err
	}

	if _, err := s.pool.Exec(ctx,
		`UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1`, userID, name); err != nil {
		return nil, fmt.Errorf("set name: %w", err)
	}

	return s.GetUserByID(ctx, userID)
}

// DeleteUser removes the account and everything it owns.
//
// Every table that hangs off a user declares ON DELETE CASCADE, so this does not carry a
// list of tables to work through — a list is the thing that falls out of date as the schema
// grows, and a half-deleted account is worse than a whole one. One row is the whole account.
//
// Pending email codes go too: they were requested by this address, and leaving them behind
// would let a code mailed to a deleted account still verify.
//
// ponytail: the session is the only proof this asks for, which is enough while the surface
// is dev-only; production wants the email-code step in front of it (PRD §5.10, M38.2).
func (s *AuthService) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		WITH gone AS (DELETE FROM users WHERE id = $1 RETURNING email)
		DELETE FROM email_codes WHERE email IN (SELECT email FROM gone)`, userID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	return nil
}

// validateName trims a display name and checks that it is one, returning the version that is
// stored. Trimmed here rather than at the call site so that what was checked is what is kept:
// a name of nothing but spaces would otherwise be stored as a name.
func validateName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ErrNameEmpty
	}
	if utf8.RuneCountInString(name) > NameMaxRunes {
		return "", ErrNameTooLong
	}
	return name, nil
}

func (s *AuthService) scanUser(ctx context.Context, query string, args ...interface{}) (*models.User, error) {
	user, found, err := s.findUser(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// findUser is scanUser with "no row" as a value instead of an error, because deciding
// between several cases is the whole point of the sign-in paths.
func (s *AuthService) findUser(ctx context.Context, query string, args ...interface{}) (*models.User, bool, error) {
	var user models.User
	var avatarURL *string
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&user.ID, &user.Email, &user.Name, &avatarURL, &user.HasPassword, &user.CreatedAt, &user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("failed to scan user: %w", err)
	}
	user.AvatarURL = avatarURL
	return &user, true, nil
}
