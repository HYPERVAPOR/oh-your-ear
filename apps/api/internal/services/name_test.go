package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

// A name is a label, so the rules are about shape and length and not about content: trimmed,
// not empty, and short enough to sit inside the card it is drawn in.
func TestValidateName(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
		err   error
	}{
		{"plain", "Alex", "Alex", nil},
		{"surrounding space is dropped", "  Alex  ", "Alex", nil},
		{"empty", "", "", ErrNameEmpty},
		{"only spaces", "   ", "", ErrNameEmpty},
		{"fifty characters", strings.Repeat("a", 50), strings.Repeat("a", 50), nil},
		{"fifty-one characters", strings.Repeat("a", 51), "", ErrNameTooLong},
		// Counted in characters, so a fifty-character Chinese name fits inside 150 bytes.
		{"fifty Chinese characters", strings.Repeat("名", 50), strings.Repeat("名", 50), nil},
		{"fifty-one Chinese characters", strings.Repeat("名", 51), "", ErrNameTooLong},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := validateName(c.input)
			if !errors.Is(err, c.err) {
				t.Fatalf("validateName(%q) = %v, want %v", c.input, err, c.err)
			}
			if got != c.want {
				t.Errorf("validateName(%q) = %q, want %q", c.input, got, c.want)
			}
		})
	}
}

// The write path, which the pure test above cannot see: an account that signed up with a code
// starts with a null name — the card shows a placeholder for it — and after this it has one,
// read back the same way /auth/me reads it.
//
// Needs a database (TEST_DATABASE_URL); CI has no Postgres and skips it.
func TestSetName(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()
	email := fmt.Sprintf("name-test-%d@ohyourear.test", time.Now().UnixNano())

	t.Cleanup(func() {
		_, _ = svc.pool.Exec(ctx, `DELETE FROM users WHERE email = $1`, email)
	})

	user, err := svc.UpsertEmailUser(ctx, email, nil)
	if err != nil {
		t.Fatalf("failed to create the account: %v", err)
	}
	if user.Name != nil {
		t.Fatalf("a code-signed-up account should start with no name, got %q", *user.Name)
	}

	t.Run("a name is stored and read back", func(t *testing.T) {
		updated, err := svc.SetName(ctx, user.ID, "  Alex  ")
		if err != nil {
			t.Fatalf("SetName failed: %v", err)
		}
		if updated.Name == nil || *updated.Name != "Alex" {
			t.Fatalf("the account should come back named Alex, got %v", updated.Name)
		}

		// The row, not just the struct that was handed back.
		readBack, err := svc.GetUserByID(ctx, user.ID)
		if err != nil {
			t.Fatalf("failed to read the account back: %v", err)
		}
		if readBack.Name == nil || *readBack.Name != "Alex" {
			t.Errorf("the row should carry the name too, got %v", readBack.Name)
		}
	})

	t.Run("a blank name is refused and changes nothing", func(t *testing.T) {
		if _, err := svc.SetName(ctx, user.ID, "   "); !errors.Is(err, ErrNameEmpty) {
			t.Fatalf("a blank name should be ErrNameEmpty, got %v", err)
		}

		readBack, err := svc.GetUserByID(ctx, user.ID)
		if err != nil {
			t.Fatalf("failed to read the account back: %v", err)
		}
		if readBack.Name == nil || *readBack.Name != "Alex" {
			t.Errorf("a refused name should leave the old one alone, got %v", readBack.Name)
		}
	})
}
