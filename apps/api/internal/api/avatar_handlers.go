package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
)

// GetMyAvatar handles GET /me/avatar: the picture this user uploaded.
func (s *Server) GetMyAvatar(c *gin.Context) {
	userID, ok := s.avatarViewer(c)
	if !ok {
		return
	}

	image, mime, updatedAt, err := s.auth.GetAvatar(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "no avatar"})
		return
	}

	// The URL carries a version, so this response may be cached for as long as the
	// picture does not change.
	c.Header("Cache-Control", "private, max-age=31536000, immutable")
	c.Header("ETag", fmt.Sprintf(`"%d"`, updatedAt.Unix()))
	c.Data(http.StatusOK, mime, image)
}

// avatarViewer is requireUser plus the session cookie. The picture is fetched by an <img>
// tag, which cannot send an Authorization header, so this one route also accepts the cookie
// the browser sends on its own — and only this one does. The cookie passes the same checks
// the refresh endpoint makes, revocation list included, so signing out stops the picture
// from loading as well.
func (s *Server) avatarViewer(c *gin.Context) (uuid.UUID, bool) {
	if raw, err := c.Cookie(auth.RefreshTokenCookieName); err == nil && raw != "" {
		if claims, err := auth.ParseToken(raw, s.cfg.JWTSecret); err == nil && claims.Type == "refresh" {
			if revoked, err := s.auth.IsTokenRevoked(c.Request.Context(), claims.ID); err == nil && !revoked {
				if userID, err := uuid.Parse(claims.UserID); err == nil {
					return userID, true
				}
			}
		}
	}
	return s.requireUser(c)
}

// PutMyAvatar handles POST /me/avatar: store the picture the reader chose, replacing any
// earlier one. The bytes decide the format — the request's content type proves nothing.
func (s *Server) PutMyAvatar(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	header, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "a file field is required"})
		return
	}
	if header.Size > services.MaxAvatarBytes {
		c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{Error: "avatar is too large"})
		return
	}

	file, err := header.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "the upload could not be read"})
		return
	}
	defer func() { _ = file.Close() }()

	// One byte over the limit, so a lying Content-Length still stops here.
	data, err := io.ReadAll(io.LimitReader(file, services.MaxAvatarBytes+1))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "the upload could not be read"})
		return
	}

	switch err := s.auth.PutAvatar(c.Request.Context(), userID, data); {
	case err == nil:
	case errors.Is(err, services.ErrAvatarTooBig):
		c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{Error: "avatar is too large"})
		return
	default:
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "avatar must be a png or jpeg, at least 16x16 and at most 1024x1024"})
		return
	}

	user, err := s.auth.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "avatar saved, but the account could not be read back"})
		return
	}
	c.JSON(http.StatusOK, s.userResponse(c, *user))
}

// DeleteMyAvatar handles DELETE /me/avatar: drop the uploaded picture. The provider's
// picture, if the account has one, is what comes back.
func (s *Server) DeleteMyAvatar(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	if err := s.auth.DeleteAvatar(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "the avatar could not be removed"})
		return
	}

	c.Status(http.StatusNoContent)
}
