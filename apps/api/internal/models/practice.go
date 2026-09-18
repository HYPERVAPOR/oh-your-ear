package models

import (
	"time"

	"github.com/google/uuid"
)

// StudyPlan is a user's daily practice target and the modules to focus on.
type StudyPlan struct {
	UserID         uuid.UUID
	DailyGoal      int
	FocusExercises []string
}

// DailyProgress counts solved and correct answers within one local calendar day.
type DailyProgress struct {
	Date       time.Time
	Solved     int
	Correct    int
	ByExercise map[string]int
}
