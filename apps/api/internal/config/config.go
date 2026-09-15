package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds application configuration.
type Config struct {
	ServerAddr  string
	DatabaseURL string
	JWTSecret   string
}

// Load reads configuration from environment variables.
func Load() Config {
	_ = godotenv.Load()

	return Config{
		ServerAddr:  getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/ohyourear?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
