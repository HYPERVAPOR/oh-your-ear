package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
)

// The picture reaches the browser through an <img> tag, which cannot send an
// Authorization header, so this route has to accept the session cookie. It is also the only
// route that does, and "a cookie" is not a free pass: an access token in that slot is not a
// session, and neither is a string that is not a token at all.
func TestAvatarViewer(t *testing.T) {
	const secret = "test-secret"
	const email = "reader@example.com"
	gin.SetMode(gin.TestMode)

	server := &Server{cfg: config.Config{JWTSecret: secret}}
	userID := uuid.New()

	refresh, err := auth.GenerateRefreshToken(userID.String(), email, secret, time.Hour)
	if err != nil {
		t.Fatalf("could not mint a refresh token: %v", err)
	}
	access, err := auth.GenerateAccessToken(userID.String(), email, secret, time.Minute)
	if err != nil {
		t.Fatalf("could not mint an access token: %v", err)
	}

	cases := []struct {
		name   string
		cookie string
		header string
		want   bool
		status int
	}{
		{"the access token in the header still works", "", access, true, http.StatusOK},
		{"an access token in the cookie is not a session", access, "", false, http.StatusUnauthorized},
		{"a cookie that is not a token", "not-a-token", "", false, http.StatusUnauthorized},
		{"nothing at all", "", "", false, http.StatusUnauthorized},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/me/avatar", nil)
			if tc.cookie != "" {
				c.Request.AddCookie(&http.Cookie{Name: auth.RefreshTokenCookieName, Value: tc.cookie})
			}
			if tc.header != "" {
				c.Request.Header.Set("Authorization", "Bearer "+tc.header)
			}

			got, ok := server.avatarViewer(c)
			if ok != tc.want {
				t.Fatalf("ok = %v, want %v", ok, tc.want)
			}
			if ok && got != userID {
				t.Fatalf("user = %s, want %s", got, userID)
			}
			if !ok && recorder.Code != tc.status {
				t.Fatalf("status = %d, want %d", recorder.Code, tc.status)
			}
		})
	}

	// The case that matters ends at the revocation list, which is a table, so it needs a
	// database. `TEST_DATABASE_URL` names one; CI has no Postgres and skips it there.
	t.Run("the refresh cookie identifies the viewer", func(t *testing.T) {
		server := newAvatarTestServer(t, secret)

		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/me/avatar", nil)
		c.Request.AddCookie(&http.Cookie{Name: auth.RefreshTokenCookieName, Value: refresh})

		got, ok := server.avatarViewer(c)
		if !ok || got != userID {
			t.Fatalf("the session cookie did not identify the viewer (ok=%v, user=%s)", ok, got)
		}
	})
}

func newAvatarTestServer(t *testing.T, secret string) *Server {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set: skipping the database-backed avatar test")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("failed to open the test database: %v", err)
	}
	t.Cleanup(pool.Close)

	return &Server{cfg: config.Config{JWTSecret: secret}, auth: services.NewAuthService(pool)}
}
