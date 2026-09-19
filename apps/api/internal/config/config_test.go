package config

import "testing"

// The mock login route is registered only when this is set (see registerAuthRoutes), so a
// default value here is an open door on any deployment that forgets to configure it:
// one unauthenticated POST would mint a session.
func TestMockAuthHasNoDefault(t *testing.T) {
	t.Setenv("MOCK_AUTH_EMAIL", "")
	t.Setenv("MOCK_AUTH_NAME", "")

	cfg := Load()
	if cfg.MockAuthEmail != "" {
		t.Fatalf("MOCK_AUTH_EMAIL must default to empty, got %q", cfg.MockAuthEmail)
	}
}
