package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	AccessTokenCookieName  = "access_token"
	RefreshTokenCookieName = "refresh_token"
)

var (
	ErrInvalidToken = fmt.Errorf("invalid token")
)

type TokenClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Type   string `json:"type"`
	jwt.RegisteredClaims
}

// NewTokenID returns the jti for a freshly issued token. Refresh tokens are
// revoked by id, which is what makes logging out actually end a session.
func NewTokenID() string {
	return uuid.NewString()
}

func generateToken(userID, email, tokenType, secret string, ttl time.Duration) (string, error) {
	claims := TokenClaims{
		UserID: userID,
		Email:  email,
		Type:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        NewTokenID(),
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateAccessToken creates a short-lived access token.
func GenerateAccessToken(userID, email, secret string, ttl time.Duration) (string, error) {
	return generateToken(userID, email, "access", secret, ttl)
}

// GenerateRefreshToken creates a long-lived refresh token.
func GenerateRefreshToken(userID, email, secret string, ttl time.Duration) (string, error) {
	return generateToken(userID, email, "refresh", secret, ttl)
}

// ParseToken validates a token string and returns its claims.
func ParseToken(tokenStr, secret string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*TokenClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// ValidateUserID parses and returns the user ID from a string UUID.
func ValidateUserID(id string) (uuid.UUID, error) {
	return uuid.Parse(id)
}
