package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	// OAuthStateCookieName holds the CSRF state for an in-flight Google login.
	OAuthStateCookieName = "oauth_state"
	// OAuthStateTTL bounds how long a login attempt may stay in flight.
	OAuthStateTTL = 10 * time.Minute
)

// GoogleUser represents the data returned by Google's userinfo endpoint.
type GoogleUser struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// NewGoogleOAuthConfig builds an OAuth2 config for Google.
func NewGoogleOAuthConfig(clientID, clientSecret, redirectURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

// NewOAuthState returns a random value that ties an OAuth callback to the browser
// that started the flow.
func NewOAuthState() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate oauth state: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// FetchGoogleUser retrieves profile information using an OAuth2 token.
func FetchGoogleUser(ctx context.Context, token *oauth2.Token) (*GoogleUser, error) {
	client := oauth2.NewClient(ctx, oauth2.StaticTokenSource(token))
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch google user: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google userinfo returned status %d", resp.StatusCode)
	}

	var user GoogleUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode google user: %w", err)
	}
	return &user, nil
}
