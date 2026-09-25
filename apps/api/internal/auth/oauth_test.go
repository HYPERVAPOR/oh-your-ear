package auth

import "testing"

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
