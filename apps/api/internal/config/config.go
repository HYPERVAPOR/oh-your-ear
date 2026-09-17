package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds application configuration.
type Config struct {
	ServerAddr      string
	DatabaseURL     string
	JWTSecret       string
	GoogleClientID  string
	GoogleSecret    string
	GoogleRedirect  string
	MockAuthEmail   string
	MockAuthName    string
	AccessTokenTTL  string
	RefreshTokenTTL string
}

// Load reads configuration from environment variables.
func Load() Config {
	_ = godotenv.Load()

	return Config{
		ServerAddr:      getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/ohyourear?sslmode=disable"),
		JWTSecret:       getEnv("JWT_SECRET", "change-me-in-production"),
		GoogleClientID:  getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleSecret:    getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirect:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),
		MockAuthEmail:   getEnv("MOCK_AUTH_EMAIL", "dev@ohyourear.test"),
		MockAuthName:    getEnv("MOCK_AUTH_NAME", "Developer"),
		AccessTokenTTL:  getEnv("ACCESS_TOKEN_TTL", "15m"),
		RefreshTokenTTL: getEnv("REFRESH_TOKEN_TTL", "7d"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
