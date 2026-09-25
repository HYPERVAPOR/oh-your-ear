package services

import (
	"errors"
	"strings"
	"testing"
)

func TestValidatePassword(t *testing.T) {
	cases := []struct {
		name     string
		password string
		want     error
	}{
		{"eight characters", "12345678", nil},
		{"seven characters", "1234567", ErrPasswordTooShort},
		{"empty", "", ErrPasswordTooShort},
		// The floor counts characters, so eight Chinese ones pass even though they are
		// 24 bytes: a passphrase should not be held to a different bar by script.
		{"eight Chinese characters", strings.Repeat("密", 8), nil},
		{"seven Chinese characters", strings.Repeat("密", 7), ErrPasswordTooShort},
		// The ceiling is bcrypt's, and it is counted in bytes because that is what bcrypt
		// truncates at. Exactly 72 is fine; 73 is refused rather than silently cropped.
		{"72 bytes", strings.Repeat("a", 72), nil},
		{"73 bytes", strings.Repeat("a", 73), ErrPasswordTooLong},
		{"25 Chinese characters (75 bytes)", strings.Repeat("密", 25), ErrPasswordTooLong},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := validatePassword(c.password)
			if !errors.Is(err, c.want) {
				t.Errorf("validatePassword(%d chars) = %v, want %v", len(c.password), err, c.want)
			}
		})
	}
}

func TestHashAndVerifyPassword(t *testing.T) {
	const password = "correct horse battery staple"

	hash, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword failed: %v", err)
	}
	if hash == password {
		t.Fatal("the hash is the password")
	}
	if !strings.HasPrefix(hash, "$2") {
		t.Errorf("hash %q is not a bcrypt string", hash)
	}
	if !verifyPassword(hash, password) {
		t.Error("the right password did not verify")
	}
	if verifyPassword(hash, password+"!") {
		t.Error("a wrong password verified")
	}

	// Two hashes of the same password differ: bcrypt salts each one, so a leaked database
	// does not hand an attacker a list of accounts that share a password.
	second, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword failed: %v", err)
	}
	if hash == second {
		t.Error("the same password hashed to the same string twice")
	}
	if !verifyPassword(second, password) {
		t.Error("the second hash did not verify")
	}
}
