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
	if l.allow(c.ClientIP()) {
		return true
	}

	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
	return false
}

func (l *RateLimiter) allow(key string) bool {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	entry, ok := l.hits[key]
	if !ok || now.Sub(entry.start) >= l.interval {
		if len(l.hits) > 10_000 {
			l.pruneLocked(now)
		}
		l.hits[key] = &window{count: 1, start: now}
		return true
	}

	entry.count++
	return entry.count <= l.limit
}

func (l *RateLimiter) pruneLocked(now time.Time) {
	for key, entry := range l.hits {
		if now.Sub(entry.start) >= l.interval {
			delete(l.hits, key)
		}
	}
}
