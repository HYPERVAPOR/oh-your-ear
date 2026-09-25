package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// These tests need a database, because the thing under test is *which row a sign-in lands
// on*. `TEST_DATABASE_URL` names one; CI has no Postgres, so it skips them there.
func newTestService(t *testing.T) *AuthService {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set: skipping the database-backed sign-in tests")
	}

	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("failed to open the test database: %v", err)
	}
	t.Cleanup(pool.Close)
	return NewAuthService(pool)
}

// An address is one identity and a sign-in method is a key to it (PRD 5.10). A Google
// account arriving at an address that already has an account joins it; it does not create
// a second one, and it does not take over one that belongs to a different Google account.
func TestUpsertGoogleUserMergesByEmail(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()
	stamp := fmt.Sprintf("%d", time.Now().UnixNano())

	cleanup := func() {
		_, _ = svc.pool.Exec(ctx, `DELETE FROM users WHERE email LIKE $1`, "google-claim-%")
	}
	cleanup()
	t.Cleanup(cleanup)

	email := "google-claim-" + stamp + "@test.local"
	password := "a password"

	// The account as it exists before Google: signed in by code, with a password set.
	byCode, err := svc.UpsertEmailUser(ctx, email, nil)
	if err != nil {
		t.Fatalf("failed to create the email account: %v", err)
	}
	if err := svc.SetPassword(ctx, byCode.ID, nil, password); err != nil {
		t.Fatalf("failed to set a password: %v", err)
	}

	// 1. Google arrives at an address that already has an account: same row, linked.
	linked, err := svc.UpsertGoogleUser(ctx, "google-"+stamp, email, "Google Name", "https://x/y.png")
	if err != nil {
		t.Fatalf("linking a google account to an existing address failed: %v", err)
	}
	if linked.ID != byCode.ID {
		t.Errorf("google sign-in made a second account %s, want the existing %s", linked.ID, byCode.ID)
	}
	if !linked.HasPassword {
		t.Error("linking dropped the password")
	}
	if linked.AvatarURL == nil || *linked.AvatarURL != "https://x/y.png" {
		t.Errorf("provider picture was not stored: %v", linked.AvatarURL)
	}

	// 2. The same Google account again, now with a different address: still one account, and
	//    the address follows the provider.
	movedEmail := "google-claim-moved-" + stamp + "@test.local"
	moved, err := svc.UpsertGoogleUser(ctx, "google-"+stamp, movedEmail, "", "")
	if err != nil {
		t.Fatalf("second google sign-in failed: %v", err)
	}
	if moved.ID != byCode.ID {
		t.Errorf("a known google account resolved to %s, want %s", moved.ID, byCode.ID)
	}
	if moved.Email != movedEmail {
		t.Errorf("address = %q, want %q", moved.Email, movedEmail)
	}
	// No picture this time: the stored one stays. A provider saying nothing is not a reason
	// to forget what it said before.
	if moved.AvatarURL == nil || *moved.AvatarURL != "https://x/y.png" {
		t.Errorf("a missing picture cleared the stored one: %v", moved.AvatarURL)
	}

	// 3. A *different* Google account claiming that address: refused, not re-linked.
	if _, err := svc.UpsertGoogleUser(ctx, "other-"+stamp, movedEmail, "", ""); !errors.Is(err, ErrEmailLinked) {
		t.Errorf("a second google account claiming the address gave %v, want ErrEmailLinked", err)
	}

	// 4. A fresh address makes a fresh account.
	fresh, err := svc.UpsertGoogleUser(ctx, "fresh-"+stamp, "google-claim-fresh-"+stamp+"@test.local", "", "")
	if err != nil {
		t.Fatalf("a new address failed to create an account: %v", err)
	}
	if fresh.ID == byCode.ID {
		t.Error("a new address landed on the existing account")
	}
}

// A Google account whose address has moved onto another account is the same conflict seen
// from the other side, and it must not surface as a server error.
func TestUpsertGoogleUserRefusesAnAddressOwnedByAnotherAccount(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()
	stamp := fmt.Sprintf("%d", time.Now().UnixNano())

	cleanup := func() {
		_, _ = svc.pool.Exec(ctx, `DELETE FROM users WHERE email LIKE $1`, "google-move-%")
	}
	cleanup()
	t.Cleanup(cleanup)

	first := "google-move-first-" + stamp + "@test.local"
	second := "google-move-second-" + stamp + "@test.local"
	if _, err := svc.UpsertGoogleUser(ctx, "first-"+stamp, first, "First", ""); err != nil {
		t.Fatalf("failed to create the first account: %v", err)
	}
	if _, err := svc.UpsertGoogleUser(ctx, "second-"+stamp, second, "Second", ""); err != nil {
		t.Fatalf("failed to create the second account: %v", err)
	}

	// The first Google account now presents the second account's address.
	if _, err := svc.UpsertGoogleUser(ctx, "first-"+stamp, second, "First", ""); !errors.Is(err, ErrEmailLinked) {
		t.Errorf("moving onto a taken address gave %v, want ErrEmailLinked", err)
	}
}
