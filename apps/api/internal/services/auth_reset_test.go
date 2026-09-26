package services

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

// The reset path: an email code standing in for the current password, for the reader who no
// longer has one. Four things have to hold — the code is really checked, a rejected password
// does not burn the code, the new password works, and the old one stops working.
//
// Needs a database (TEST_DATABASE_URL); CI has no Postgres and skips it.
func TestResetPassword(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()
	email := fmt.Sprintf("reset-test-%d@ohyourear.test", time.Now().UnixNano())

	t.Cleanup(func() {
		_, _ = svc.pool.Exec(ctx, `DELETE FROM email_codes WHERE email = $1`, email)
		_, _ = svc.pool.Exec(ctx, `DELETE FROM users WHERE email = $1`, email)
	})

	newCode := func(t *testing.T) string {
		t.Helper()
		code, err := svc.RequestEmailCode(ctx, email)
		if err != nil {
			t.Fatalf("failed to request a code: %v", err)
		}
		return code
	}

	code := newCode(t)
	wrong := "000000"
	if wrong == code {
		wrong = "111111"
	}

	t.Run("a wrong code is refused", func(t *testing.T) {
		_, err := svc.ResetPassword(ctx, email, wrong, "correct horse battery")
		if !errors.Is(err, ErrInvalidCode) {
			t.Fatalf("a wrong code should be ErrInvalidCode, got %v", err)
		}
	})

	t.Run("a rejected password does not spend the code", func(t *testing.T) {
		if _, err := svc.ResetPassword(ctx, email, code, "short"); !errors.Is(err, ErrPasswordTooShort) {
			t.Fatalf("a short password should be ErrPasswordTooShort, got %v", err)
		}
		// The same code, right after: it has to still be there.
		if _, err := svc.ResetPassword(ctx, email, code, "correct horse battery"); err != nil {
			t.Fatalf("the code should still work after a rejected password, got %v", err)
		}
	})

	t.Run("the new password signs in, and takes over from the old one", func(t *testing.T) {
		if _, err := svc.LoginWithPassword(ctx, email, "correct horse battery"); err != nil {
			t.Fatalf("the new password should sign in: %v", err)
		}

		second := newCode(t)
		if _, err := svc.ResetPassword(ctx, email, second, "a different password"); err != nil {
			t.Fatalf("resetting over an existing password should not need it: %v", err)
		}
		if _, err := svc.LoginWithPassword(ctx, email, "correct horse battery"); !errors.Is(err, ErrBadCredentials) {
			t.Fatalf("the previous password should be gone, got %v", err)
		}
		if _, err := svc.LoginWithPassword(ctx, email, "a different password"); err != nil {
			t.Fatalf("the newest password should sign in: %v", err)
		}
	})

	t.Run("the code is spent", func(t *testing.T) {
		third := newCode(t)
		if _, err := svc.ResetPassword(ctx, email, third, "one more password"); err != nil {
			t.Fatalf("the first use should work: %v", err)
		}
		if _, err := svc.ResetPassword(ctx, email, third, "one more password"); !errors.Is(err, ErrInvalidCode) {
			t.Fatalf("a code should only work once, got %v", err)
		}
	})
}
