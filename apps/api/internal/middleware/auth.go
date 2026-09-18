package middleware

import (
	"net/http"
	"strings"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/gin-gonic/gin"
)

// Auth validates the access token on the current request.
//
// It is called from inside protected handlers: the generated router registers
// every route up front, so engine-level Use() middleware would never reach them.
// It reports whether the caller may continue and writes the 401 itself.
func Auth(c *gin.Context, secret string) bool {
	tokenStr := extractBearerToken(c)
	if tokenStr == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing access token"})
		return false
	}

	claims, err := auth.ParseToken(tokenStr, secret)
	if err != nil || claims.Type != "access" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid access token"})
		return false
	}

	c.Set("user", claims)
	return true
}

func extractBearerToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}
	return parts[1]
}
