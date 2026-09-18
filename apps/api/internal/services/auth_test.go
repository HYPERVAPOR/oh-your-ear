package services

import (
	"testing"
	"time"
)

func TestCheckEmailCode(t *testing.T) {
	now := time.Now().UTC()
	valid := hashEmailCode("user@example.com", "123456")

	cases := []struct {
		name     string
		email    string
		provided string
		expires  time.Time
		attempts int
		want     codeCheck
	}{
		{"matching code", "user@example.com", "123456", now.Add(time.Minute), 0, codeOK},
		{"wrong code", "user@example.com", "654321", now.Add(time.Minute), 0, codeMismatch},
		{"code for another address", "other@example.com", "123456", now.Add(time.Minute), 0, codeMismatch},
		{"expired", "user@example.com", "123456", now.Add(-time.Second), 0, codeExpired},
		{"locked", "user@example.com", "123456", now.Add(time.Minute), EmailCodeMaxAttempts, codeLocked},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := checkEmailCode(tc.email, valid, tc.provided, tc.expires, tc.attempts, now); got != tc.want {
				t.Fatalf("checkEmailCode() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestNewEmailCode(t *testing.T) {
	seen := make(map[string]bool)
	for range 50 {
		code, err := newEmailCode()
		if err != nil {
			t.Fatalf("newEmailCode() error = %v", err)
		}
		if len(code) != 6 {
			t.Fatalf("newEmailCode() = %q, want 6 digits", code)
		}
		for _, r := range code {
			if r < '0' || r > '9' {
				t.Fatalf("newEmailCode() = %q, want digits only", code)
			}
		}
		seen[code] = true
	}
	if len(seen) < 2 {
		t.Fatalf("newEmailCode() returned the same code 50 times")
	}
}
