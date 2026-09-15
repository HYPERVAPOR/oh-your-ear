package middleware

import (
	"github.com/gin-gonic/gin"
)

// AuthMiddleware is a placeholder for JWT authentication.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: validate JWT access token
		c.Next()
	}
}
