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
	FrontendURL     string
	AppTimezone     string
	MailDriver      string
	SMTPHost        string
	SMTPPort        string
	SMTPUsername    string
	SMTPPassword    string
	SMTPFrom        string
	TrustedProxies  string
	AccessTokenTTL  string
	RefreshTokenTTL string
}

// Load reads configuration from environment variables.
func Load() Config {
	_ = godotenv.Load()

	return Config{
		ServerAddr:     getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/ohyourear?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		GoogleClientID: getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleSecret:   getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirect: getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),
		// No default: the mock login route is only registered when this is set, so an
		// unconfigured deployment has no way in through it (see main.go).
		MockAuthEmail: getEnv("MOCK_AUTH_EMAIL", ""),
		MockAuthName:  getEnv("MOCK_AUTH_NAME", ""),
		FrontendURL:   getEnv("FRONTEND_URL", "http://localhost:5173"),
		AppTimezone:   getEnv("APP_TIMEZONE", "Asia/Shanghai"),
		MailDriver:    getEnv("MAIL_DRIVER", "log"),
		SMTPHost:      getEnv("SMTP_HOST", ""),
		SMTPPort:      getEnv("SMTP_PORT", "587"),
		SMTPUsername:  getEnv("SMTP_USERNAME", ""),
		SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:      getEnv("SMTP_FROM", "no-reply@ohyourear.local"),
		// Private ranges cover the compose network the reverse proxy sits on.
		// Trusting them is what makes X-Forwarded-For usable; trusting everyone
		// would let any caller forge its own IP and walk past rate limits.
		TrustedProxies:  getEnv("TRUSTED_PROXIES", "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"),
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
