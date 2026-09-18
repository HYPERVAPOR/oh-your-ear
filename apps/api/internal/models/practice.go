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

// ExerciseStats is the per-module slice of the progress dashboard.
type ExerciseStats struct {
	Solved  int
	Correct int
}

// Achievement is a milestone evaluated from the cumulative numbers.
type Achievement struct {
	ID       string
	Progress int
	Target   int
}

// Achieved reports whether the milestone is reached.
func (a Achievement) Achieved() bool {
	return a.Progress >= a.Target
}

// Mistake is one entry of the mistake notebook.
type Mistake struct {
	ID          uuid.UUID
	Exercise    string
	Prompt      []byte
	Answer      string
	WrongCount  int
	LastWrongAt time.Time
}
