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
