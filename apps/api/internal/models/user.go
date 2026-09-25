package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents an application user.
type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      *string   `json:"name,omitempty"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	// HasPassword is carried as a boolean on purpose: the hash itself never leaves the
	// service layer, so no response can leak it by accident.
	HasPassword bool      `json:"has_password"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
