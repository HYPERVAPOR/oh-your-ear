package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const schemaSQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	avatar_url TEXT,
	google_id TEXT UNIQUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
`

// Migrate applies the database schema.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("failed to apply schema: %w", err)
	}
	return nil
}
