package services

import (
	"context"
	"fmt"
	"time"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DefaultDailyGoal is used until a user sets their own target.
const DefaultDailyGoal = 20

// PracticeService stores practice results and study plans.
type PracticeService struct {
	pool *pgxpool.Pool
	loc  *time.Location
}

// NewPracticeService creates a PracticeService. loc decides where a practice
// day starts and ends.
func NewPracticeService(pool *pgxpool.Pool, loc *time.Location) *PracticeService {
	return &PracticeService{pool: pool, loc: loc}
}

// RecordAnswer stores the outcome of a single answered question.
func (s *PracticeService) RecordAnswer(ctx context.Context, userID uuid.UUID, exercise string, correct bool, chosen, expected *string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO practice_records (user_id, exercise, correct, chosen, expected) VALUES ($1, $2, $3, $4, $5)`,
		userID, exercise, correct, chosen, expected,
	)
	if err != nil {
		return fmt.Errorf("failed to record answer: %w", err)
	}
	return nil
}

// GetPlan returns the stored plan, or the default one when the user never saved any.
func (s *PracticeService) GetPlan(ctx context.Context, userID uuid.UUID) (*models.StudyPlan, error) {
	plan := &models.StudyPlan{UserID: userID, DailyGoal: DefaultDailyGoal, FocusExercises: []string{}}

	var dailyGoal int
	var focus []string
	err := s.pool.QueryRow(ctx,
		`SELECT daily_goal, focus_exercises FROM study_plans WHERE user_id = $1`, userID,
	).Scan(&dailyGoal, &focus)
	if err != nil {
		if err == pgx.ErrNoRows {
			return plan, nil
		}
		return nil, fmt.Errorf("failed to load study plan: %w", err)
	}

	plan.DailyGoal = dailyGoal
	if focus != nil {
		plan.FocusExercises = focus
	}
	return plan, nil
}

// UpdatePlan creates or replaces a user's study plan.
func (s *PracticeService) UpdatePlan(ctx context.Context, userID uuid.UUID, dailyGoal int, focusExercises []string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO study_plans (user_id, daily_goal, focus_exercises)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			daily_goal = EXCLUDED.daily_goal,
			focus_exercises = EXCLUDED.focus_exercises,
			updated_at = NOW()
	`, userID, dailyGoal, focusExercises)
	if err != nil {
		return fmt.Errorf("failed to save study plan: %w", err)
	}
	return nil
}

// TodayProgress aggregates the current local day for a user.
func (s *PracticeService) TodayProgress(ctx context.Context, userID uuid.UUID) (*models.DailyProgress, error) {
	// The day boundary is the user-facing calendar day in the configured zone,
	// so `now()` is projected into that zone first and back again for the filter.
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc('day', NOW() AT TIME ZONE $2)::date,
		       exercise,
		       COUNT(*)::int,
		       COUNT(*) FILTER (WHERE correct)::int
		FROM practice_records
		WHERE user_id = $1
		  AND created_at >= date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2
		GROUP BY 1, 2
	`, userID, s.loc.String())
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate today's practice: %w", err)
	}
	defer rows.Close()

	now := time.Now().In(s.loc)
	progress := &models.DailyProgress{
		Date:       time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.loc),
		ByExercise: map[string]int{},
	}
	for rows.Next() {
		var date time.Time
		var exercise string
		var solved, correct int
		if err := rows.Scan(&date, &exercise, &solved, &correct); err != nil {
			return nil, fmt.Errorf("failed to read today's practice: %w", err)
		}
		progress.Date = date
		progress.Solved += solved
		progress.Correct += correct
		progress.ByExercise[exercise] = solved
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to aggregate today's practice: %w", err)
	}

	return progress, nil
}
