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

-- Pictures a reader uploaded themselves. Kept in its own table so that listing users never
-- drags the bytes along; the sign-in provider's picture stays in users.avatar_url, and
-- neither one existing means the client draws its generated pixel avatar.
CREATE TABLE IF NOT EXISTS user_avatars (
	user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	image BYTEA NOT NULL,
	mime TEXT NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- The daily goal in force on a given day, written whenever the plan is saved.
-- Without it the calendar would have to judge past days against today's goal,
-- which silently rewrites history every time the goal changes.
CREATE TABLE IF NOT EXISTS daily_goals (
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
day DATE NOT NULL,
goal INT NOT NULL,
PRIMARY KEY (user_id, day)
);

-- The question-set catalog. Levels used to be a hardcoded array in the web client;
-- they are product content that has to grow and be curated, so they live here now.
CREATE TABLE IF NOT EXISTS level_sets (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
slug TEXT NOT NULL UNIQUE,
module TEXT NOT NULL,
title_zh TEXT NOT NULL,
title_en TEXT NOT NULL,
description_zh TEXT,
description_en TEXT,
is_official BOOLEAN NOT NULL DEFAULT TRUE,
owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
position INT NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levels (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
set_id UUID NOT NULL REFERENCES level_sets(id) ON DELETE CASCADE,
slug TEXT NOT NULL UNIQUE,
position INT NOT NULL,
title_zh TEXT NOT NULL,
title_en TEXT NOT NULL,
questions INT NOT NULL,
pass_mark DOUBLE PRECISION NOT NULL DEFAULT 0.8,
config JSONB NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE (set_id, position)
);

-- Question-set progress. The key stays the level's slug: those are the ids the
-- client has always used, so existing rows keep working, and the foreign key still
-- gives referential integrity.
CREATE TABLE IF NOT EXISTS level_progress (
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
level_id TEXT NOT NULL REFERENCES levels(slug) ON DELETE CASCADE,
module TEXT NOT NULL,
passed BOOLEAN NOT NULL DEFAULT FALSE,
best_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
passed_at TIMESTAMPTZ,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
PRIMARY KEY (user_id, level_id)
);

-- level_progress predates the catalog, and CREATE TABLE IF NOT EXISTS cannot add a
-- constraint to an existing table. There is no migration versioning here yet, so
-- structural changes to existing tables are done with idempotent blocks like this.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'level_progress_level_id_fkey'
	) THEN
		ALTER TABLE level_progress
			ADD CONSTRAINT level_progress_level_id_fkey
			FOREIGN KEY (level_id) REFERENCES levels(slug) ON DELETE CASCADE;
	END IF;
END $$;

-- Collections: a user's folders of levels. The default folder is created lazily
-- with an empty name, which the client renders in the reader's language.
CREATE TABLE IF NOT EXISTS collections (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
name TEXT NOT NULL DEFAULT '',
position INT NOT NULL DEFAULT 0,
is_default BOOLEAN NOT NULL DEFAULT FALSE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id, position);

-- One level can sit in several folders.
CREATE TABLE IF NOT EXISTS collection_items (
collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
level_id TEXT NOT NULL REFERENCES levels(slug) ON DELETE CASCADE,
added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
PRIMARY KEY (collection_id, level_id)
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
