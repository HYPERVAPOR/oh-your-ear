package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter is a fixed-window counter keyed by client IP.
//
// ponytail: in-process state, so it only counts requests that land on this
// instance. Fine for one self-hosted container; move to redis (as the tech spec
// suggests) if the API is ever scaled out.
type RateLimiter struct {
	mu       sync.Mutex
	hits     map[string]*window
	limit    int
	interval time.Duration
}

type window struct {
	count int
	start time.Time
}

// NewRateLimiter allows limit requests per client per interval.
func NewRateLimiter(limit int, interval time.Duration) *RateLimiter {
	return &RateLimiter{hits: map[string]*window{}, limit: limit, interval: interval}
}

// RateLimit reports whether the caller may proceed, answering 429 itself.
//
// Like Auth, it is called from inside a handler: the generated router registers
// every route up front, so engine-level middleware would not reach them.
func (l *RateLimiter) RateLimit(c *gin.Context) bool {
	return l.RateLimitKey(c, c.ClientIP())
}

// RateLimitKey is RateLimit with a key the caller chooses. Password attempts are counted
// per address rather than per IP: five guesses at one account are five guesses whatever
// address they come from, and an attacker with addresses to spare would otherwise walk
// straight past an IP-keyed budget.
func (l *RateLimiter) RateLimitKey(c *gin.Context, key string) bool {
	if l.allow(key) {
		return true
	}

	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
	return false
}

// Allow reports whether key still has budget, without spending any of it. Charge the
// attempt with Hit when it turns out to be a failure. Password attempts use this pair
// instead of allow: a correct password must not count against its own owner's budget, and
// a limiter that charges everything lets an attacker lock a real user out of their account
// by spending their budget for them.
func (l *RateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	return l.windowLocked(key, time.Now()).count < l.limit
}

// Hit spends one unit of the key's budget.
func (l *RateLimiter) Hit(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.windowLocked(key, time.Now()).count++
}

// allow checks the budget and spends it in one step, for limits that count requests rather
// than failures.
func (l *RateLimiter) allow(key string) bool {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	entry := l.windowLocked(key, now)
	entry.count++
	return entry.count <= l.limit
}

// windowLocked returns the key's current window, opening a fresh one when the old has run
// out. A window starts at zero so that Allow can look before anything is charged.
func (l *RateLimiter) windowLocked(key string, now time.Time) *window {
	entry, ok := l.hits[key]
	if !ok || now.Sub(entry.start) >= l.interval {
		if len(l.hits) > 10_000 {
			l.pruneLocked(now)
		}
		entry = &window{start: now}
		l.hits[key] = entry
	}
	return entry
}

func (l *RateLimiter) pruneLocked(now time.Time) {
	for key, entry := range l.hits {
		if now.Sub(entry.start) >= l.interval {
			delete(l.hits, key)
		}
	}
}
