package services

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// Deleting an account is one statement against `users`; everything else is the schema's
// cascade. That makes this test the thing that says the cascade is really there — a table
// added later without ON DELETE CASCADE would quietly leave its rows behind, and the account
// would be half-deleted with nothing else noticing.
//
// Needs a database (TEST_DATABASE_URL); CI has no Postgres and skips it.
func TestDeleteUserTakesEverythingTheAccountOwns(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()
	email := fmt.Sprintf("delete-account-%d@test.local", time.Now().UnixNano())

	user, err := svc.UpsertEmailUser(ctx, email, nil)
	if err != nil {
		t.Fatalf("failed to create the account: %v", err)
	}
	if err := svc.SetPassword(ctx, user.ID, nil, "a password"); err != nil {
		t.Fatalf("failed to set a password: %v", err)
	}

	// One row per table that hangs off an account, written directly: the point here is the
	// foreign keys, not the handlers that usually write them. `by` says what the row hangs
	// off — an account, or (for the codes) the address itself.
	owned := []struct {
		table  string
		column string
		by     string
		query  string
	}{
		{"study_plans", "user_id", "user", `INSERT INTO study_plans (user_id) VALUES ($1)`},
		{"daily_goals", "user_id", "user", `INSERT INTO daily_goals (user_id, day, goal) VALUES ($1, CURRENT_DATE, 5)`},
		{"practice_records", "user_id", "user", `INSERT INTO practice_records (user_id, exercise, correct) VALUES ($1, 'single-note', TRUE)`},
		{"mistakes", "user_id", "user", `INSERT INTO mistakes (user_id, exercise, fingerprint, answer) VALUES ($1, 'single-note', 'fp', 'C4')`},
		{"level_progress", "user_id", "user", `INSERT INTO level_progress (user_id, level_id, module) VALUES ($1, (SELECT slug FROM levels LIMIT 1), 'singleNote')`},
		{"collections", "owner_id", "user", `INSERT INTO collections (owner_id) VALUES ($1)`},
		{"user_avatars", "user_id", "user", `INSERT INTO user_avatars (user_id, image, mime) VALUES ($1, '\x00', 'image/png')`},
		{"email_codes", "email", "email", `INSERT INTO email_codes (email, code_hash, expires_at) VALUES ($1, 'hash', NOW() + INTERVAL '10 minutes')`},
	}

	value := func(by string) any {
		if by == "email" {
			return email
		}
		return user.ID
	}

	for _, row := range owned {
		if _, err := svc.pool.Exec(ctx, row.query, value(row.by)); err != nil {
			t.Fatalf("failed to seed %s: %v", row.table, err)
		}
	}

	if err := svc.DeleteUser(ctx, user.ID); err != nil {
		t.Fatalf("DeleteUser() = %v, want nil", err)
	}

	if _, err := svc.GetUserByID(ctx, user.ID); err == nil {
		t.Fatal("the account is still there after DeleteUser()")
	}

	for _, row := range owned {
		var left int
		if err := svc.pool.QueryRow(ctx,
			`SELECT count(*) FROM `+row.table+` WHERE `+row.column+` = $1`, value(row.by)).Scan(&left); err != nil {
			t.Fatalf("failed to count %s: %v", row.table, err)
		}
		if left != 0 {
			t.Errorf("%s still holds %d row(s) for a deleted account", row.table, left)
		}
	}
}
