package api

import (
	"strings"
	"testing"
)

// An email client is not a browser: anything it has to fetch is missing by the time the
// message is read, and a verification mail that renders as a broken box is worse than a
// plain one. So the template has to own every byte it draws.
func TestVerificationEmailCarriesNothingExternal(t *testing.T) {
	_, text, html := verificationEmail("123456", 10)

	for _, forbidden := range []string{"<img", "<link", "src=", "@import", "url(http", "<script"} {
		if strings.Contains(html, forbidden) {
			t.Errorf("the html references something it cannot load: %q", forbidden)
		}
	}

	if !strings.Contains(html, "123456") {
		t.Error("the html lost the code")
	}
	if !strings.Contains(text, "123456") {
		t.Error("the text part lost the code")
	}
	if strings.Contains(text, "1 2 3 4 5 6") {
		t.Error("the code is spaced out in the text part, so selecting it copies the spaces too")
	}
	// 10 as a plain number, not Go's "10m0s".
	if !strings.Contains(html, "10 分钟内有效") || !strings.Contains(html, "Expires in 10 minutes") {
		t.Error("the expiry is missing or formatted as a Go duration")
	}
	// Both languages, both in the text and the html, because one of these two readers is
	// holding the phone.
	for _, body := range []string{text, html} {
		if !strings.Contains(body, "忽略这封邮件") || !strings.Contains(body, "ignore this mail") {
			t.Error("the mail is not bilingual")
		}
	}
}
