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

CREATE TABLE IF NOT EXISTS study_plans (
user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
daily_goal INT NOT NULL DEFAULT 20 CHECK (daily_goal BETWEEN 1 AND 500),
focus_exercises TEXT[] NOT NULL DEFAULT '{}',
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per answered question. Stats are aggregated on read; add rollup
-- tables only if these queries stop being fast enough.
CREATE TABLE IF NOT EXISTS practice_records (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
exercise TEXT NOT NULL,
correct BOOLEAN NOT NULL,
chosen TEXT,
expected TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_records_user_time ON practice_records(user_id, created_at DESC);

-- Revoked refresh tokens, by jti. Rows are short-lived: they are deleted once
-- the token they block would have expired anyway.
CREATE TABLE IF NOT EXISTS revoked_tokens (
jti TEXT PRIMARY KEY,
expires_at TIMESTAMPTZ NOT NULL
);

-- Question-set progress: one row per level a signed-in user has attempted.
-- Levels themselves are product content defined in the web client, so this table
-- stores outcomes only.
CREATE TABLE IF NOT EXISTS level_progress (
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
level_id TEXT NOT NULL,
module TEXT NOT NULL,
passed BOOLEAN NOT NULL DEFAULT FALSE,
best_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
passed_at TIMESTAMPTZ,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
PRIMARY KEY (user_id, level_id)
);

-- The mistake notebook. One row per distinct wrong question, kept until the
-- user answers that same question correctly (or removes it by hand).
CREATE TABLE IF NOT EXISTS mistakes (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
exercise TEXT NOT NULL,
fingerprint TEXT NOT NULL,
prompt JSONB,
answer TEXT NOT NULL,
wrong_count INT NOT NULL DEFAULT 1,
last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
resolved_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE (user_id, exercise, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_mistakes_user_open ON mistakes(user_id, last_wrong_at DESC) WHERE resolved_at IS NULL;

-- One live verification code per address; rows are short-lived by design.
CREATE TABLE IF NOT EXISTS email_codes (
email TEXT PRIMARY KEY,
code_hash TEXT NOT NULL,
expires_at TIMESTAMPTZ NOT NULL,
attempts INT NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// Migrate applies the database schema.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("failed to apply schema: %w", err)
	}
	return nil
}
