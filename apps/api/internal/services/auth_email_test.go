package services

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// The sign-up screen asks whether an address is already registered, so it can send someone to
// sign in instead of through a code. Needs a database (TEST_DATABASE_URL); CI skips it.
func TestEmailRegistered(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()
	email := fmt.Sprintf("email-check-%d@ohyourear.test", time.Now().UnixNano())

	t.Cleanup(func() {
		_, _ = svc.pool.Exec(ctx, `DELETE FROM users WHERE email = $1`, email)
	})

	registered, err := svc.EmailRegistered(ctx, email)
	if err != nil {
		t.Fatalf("failed to check an unknown address: %v", err)
	}
	if registered {
		t.Fatal("an address with no account should not be reported as registered")
	}

	if _, err := svc.UpsertEmailUser(ctx, email, nil); err != nil {
		t.Fatalf("failed to create the account: %v", err)
	}

	registered, err = svc.EmailRegistered(ctx, email)
	if err != nil {
		t.Fatalf("failed to check a known address: %v", err)
	}
	if !registered {
		t.Fatal("an address with an account should be reported as registered")
	}
}
