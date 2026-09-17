package middleware

import (
	"net/http"
	"strings"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates the access token and sets the user claims in context.
func AuthMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractBearerToken(c)
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing access token"})
			return
		}

		claims, err := auth.ParseToken(tokenStr, secret)
		if err != nil || claims.Type != "access" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid access token"})
			return
		}

		c.Set("user", claims)
		c.Next()
	}
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
