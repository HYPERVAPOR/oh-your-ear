package middleware

import (
	"testing"
	"time"
)

func TestRateLimiterBudget(t *testing.T) {
	limiter := NewRateLimiter(3, time.Hour)

	for i := 1; i <= 3; i++ {
		if !limiter.allow("1.2.3.4") {
			t.Fatalf("request %d should be allowed", i)
		}
	}
	if limiter.allow("1.2.3.4") {
		t.Fatal("fourth request should be rejected")
	}

	// A different client has its own budget.
	if !limiter.allow("5.6.7.8") {
		t.Fatal("another client should not be throttled by the first one")
	}
}

func TestRateLimiterWindowRollsOver(t *testing.T) {
	limiter := NewRateLimiter(1, 50*time.Millisecond)

	if !limiter.allow("1.2.3.4") {
		t.Fatal("first request should be allowed")
	}
	if limiter.allow("1.2.3.4") {
		t.Fatal("second request in the same window should be rejected")
	}

	time.Sleep(60 * time.Millisecond)
	if !limiter.allow("1.2.3.4") {
		t.Fatal("request after the window should be allowed again")
	}
}

// Allow is a look, Hit is a charge: password attempts count failures only, so that a
// correct password never spends its owner's budget.
func TestAllowDoesNotSpendUntilHit(t *testing.T) {
	l := NewRateLimiter(2, time.Minute)

	if !l.Allow("a@b.test") {
		t.Fatal("a fresh key was refused")
	}
	// Looking five times is still free: nothing was charged.
	for i := 0; i < 5; i++ {
		if !l.Allow("a@b.test") {
			t.Fatalf("Allow charged the caller on look %d", i+1)
		}
	}

	l.Hit("a@b.test")
	if !l.Allow("a@b.test") {
		t.Error("refused after one charge of a budget of two")
	}
	l.Hit("a@b.test")
	if l.Allow("a@b.test") {
		t.Error("allowed after spending the whole budget")
	}

	// Another key has its own budget.
	if !l.Allow("c@d.test") {
		t.Error("a different key was refused")
	}
}
