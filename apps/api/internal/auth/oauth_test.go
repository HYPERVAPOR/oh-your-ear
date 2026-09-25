package auth

import (
	"encoding/json"
	"testing"
)

// A redirect target that comes from the query string is attacker-controlled input:
// anything that is not plainly a path on this site has to be thrown away.
func TestSafeNextPath(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", "/"},
		{"/", "/"},
		{"/daily", "/daily"},
		{"/exercise/interval?level=c-major&round=10", "/exercise/interval?level=c-major&round=10"},
		{"//evil.example", "/"},
		{"///evil.example", "/"},
		{"/\\evil.example", "/"},
		{"https://evil.example", "/"},
		{"javascript:alert(1)", "/"},
		{"relative/path", "/"},
		{"/a\nb", "/"},
		{"/a\r\nLocation: https://evil.example", "/"},
		{"/a\tb", "/"},
	}

	for _, c := range cases {
		if got := SafeNextPath(c.in); got != c.want {
			t.Errorf("SafeNextPath(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// The v2 userinfo endpoint names the verified flag `verified_email`; v3/OIDC calls it
// `email_verified`. Binding the wrong one would report every Google address as unverified
// — which now means refusing every Google sign-in — and nothing else would fail. So the
// spelling is pinned here, against the shape in Google's discovery document (the oauth2 v2
// Userinfo schema).
func TestGoogleUserParsesVerifiedEmail(t *testing.T) {
	var user GoogleUser
	payload := `{"id":"1","email":"a@b.test","verified_email":true,"name":"A","picture":"https://x/y.png"}`
	if err := json.Unmarshal([]byte(payload), &user); err != nil {
		t.Fatalf("failed to unmarshal a userinfo payload: %v", err)
	}
	if !user.VerifiedEmail {
		t.Error("`verified_email` did not bind: the field name is wrong for the v2 endpoint")
	}
	if user.ID != "1" || user.Email != "a@b.test" || user.Name != "A" || user.Picture != "https://x/y.png" {
		t.Errorf("userinfo did not parse: %+v", user)
	}

	// A payload without the flag, and one that says false, both mean "not verified": the
	// zero value has to be the safe one.
	for _, absent := range []string{`{"id":"2","email":"c@d.test"}`, `{"id":"2","email":"c@d.test","verified_email":false}`} {
		var unverified GoogleUser
		if err := json.Unmarshal([]byte(absent), &unverified); err != nil {
			t.Fatalf("failed to unmarshal %s: %v", absent, err)
		}
		if unverified.VerifiedEmail {
			t.Errorf("%s was read as verified", absent)
		}
	}
}
