package services

import (
	"bytes"
	"context"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"time"

	"github.com/google/uuid"
)

// MaxAvatarBytes caps an uploaded picture. The web client scales to 256x256 before it
// sends, so this is a ceiling rather than a target.
const MaxAvatarBytes = 512 << 10

var (
	// ErrAvatarTooBig means the upload is over MaxAvatarBytes.
	ErrAvatarTooBig = errors.New("avatar is too large")
	// ErrAvatarUnreadable means the upload is not a PNG or JPEG we can decode.
	ErrAvatarUnreadable = errors.New("avatar is not a readable png or jpeg")
	// ErrNoAvatar means this reader has not uploaded one.
	ErrNoAvatar = errors.New("no avatar")
)

// The format comes from decoding the bytes, never from the request's content type: a
// client can claim anything. WebP is left out because the standard library cannot read
// it, and it would be stored unverified.
var avatarMimeTypes = map[string]string{"png": "image/png", "jpeg": "image/jpeg"}

// validateAvatar checks size, format and dimensions and reports the storage mime type.
func validateAvatar(data []byte) (string, error) {
	if len(data) == 0 || len(data) > MaxAvatarBytes {
		return "", ErrAvatarTooBig
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return "", ErrAvatarUnreadable
	}
	mime, ok := avatarMimeTypes[format]
	if !ok {
		return "", ErrAvatarUnreadable
	}
	// A 1x1 "avatar" is not one, and a 4000px one is not worth storing.
	if config.Width < 16 || config.Height < 16 || config.Width > 1024 || config.Height > 1024 {
		return "", ErrAvatarUnreadable
	}
	return mime, nil
}

// PutAvatar stores the picture a reader chose, replacing any earlier one.
func (s *AuthService) PutAvatar(ctx context.Context, userID uuid.UUID, data []byte) error {
	mime, err := validateAvatar(data)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO user_avatars (user_id, image, mime, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			image = EXCLUDED.image,
			mime = EXCLUDED.mime,
			updated_at = NOW()
	`, userID, data, mime)
	return err
}

// GetAvatar returns the uploaded picture, its mime type and when it was replaced.
func (s *AuthService) GetAvatar(ctx context.Context, userID uuid.UUID) ([]byte, string, time.Time, error) {
	var (
		image     []byte
		mime      string
		updatedAt time.Time
	)
	err := s.pool.QueryRow(ctx,
		`SELECT image, mime, updated_at FROM user_avatars WHERE user_id = $1`, userID,
	).Scan(&image, &mime, &updatedAt)
	if err != nil {
		return nil, "", time.Time{}, ErrNoAvatar
	}
	return image, mime, updatedAt, nil
}

// AvatarUpdatedAt reports when the reader last replaced their uploaded picture, if they
// have one. It is what versions the URL the client points at, so a replacement is not
// served from a cache.
func (s *AuthService) AvatarUpdatedAt(ctx context.Context, userID uuid.UUID) (time.Time, bool) {
	var updatedAt time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT updated_at FROM user_avatars WHERE user_id = $1`, userID,
	).Scan(&updatedAt)
	return updatedAt, err == nil
}

// DeleteAvatar drops the uploaded picture. The provider's picture, if any, comes back.
func (s *AuthService) DeleteAvatar(ctx context.Context, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM user_avatars WHERE user_id = $1`, userID)
	return err
}
