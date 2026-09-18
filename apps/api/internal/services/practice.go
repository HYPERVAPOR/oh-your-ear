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

// TrendDays is how many days the stats trend covers (see dev-plan 8.2).
const TrendDays = 14

// Stats aggregates the numbers behind the progress dashboard.
type Stats struct {
	Solved     int
	Correct    int
	ByExercise map[string]models.ExerciseStats
	Daily      []models.DailyProgress
}

// StatsForUser aggregates totals, a per-exercise breakdown, and a daily trend
// covering the last TrendDays local days, zero-filled so gaps stay visible.
func (s *PracticeService) StatsForUser(ctx context.Context, userID uuid.UUID) (*Stats, error) {
	stats := &Stats{ByExercise: map[string]models.ExerciseStats{}}

	byExercise, err := s.pool.Query(ctx, `
		SELECT exercise, COUNT(*)::int, COUNT(*) FILTER (WHERE correct)::int
		FROM practice_records
		WHERE user_id = $1
		GROUP BY exercise
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate practice records: %w", err)
	}
	defer byExercise.Close()

	for byExercise.Next() {
		var exercise string
		var solved, correct int
		if err := byExercise.Scan(&exercise, &solved, &correct); err != nil {
			return nil, fmt.Errorf("failed to read practice records: %w", err)
		}
		stats.ByExercise[exercise] = models.ExerciseStats{Solved: solved, Correct: correct}
		stats.Solved += solved
		stats.Correct += correct
	}
	if err := byExercise.Err(); err != nil {
		return nil, fmt.Errorf("failed to aggregate practice records: %w", err)
	}

	daily, err := s.pool.Query(ctx, `
		SELECT day, solved, correct
		FROM (
			SELECT date_trunc('day', created_at AT TIME ZONE $2)::date AS day,
			       COUNT(*)::int AS solved,
			       COUNT(*) FILTER (WHERE correct)::int AS correct
			FROM practice_records
			WHERE user_id = $1
			  AND created_at >= date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2 - ($3::int - 1) * INTERVAL '1 day'
			GROUP BY 1
		) AS per_day
		ORDER BY day
	`, userID, s.loc.String(), TrendDays)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate the daily trend: %w", err)
	}
	defer daily.Close()

	counts := map[string]models.DailyProgress{}
	for daily.Next() {
		var entry models.DailyProgress
		if err := daily.Scan(&entry.Date, &entry.Solved, &entry.Correct); err != nil {
			return nil, fmt.Errorf("failed to read the daily trend: %w", err)
		}
		counts[entry.Date.Format("2006-01-02")] = entry
	}
	if err := daily.Err(); err != nil {
		return nil, fmt.Errorf("failed to aggregate the daily trend: %w", err)
	}

	stats.Daily = fillTrend(counts, s.loc, TrendDays)
	return stats, nil
}

// fillTrend returns one entry per day for the last days days, oldest first.
func fillTrend(counts map[string]models.DailyProgress, loc *time.Location, days int) []models.DailyProgress {
	now := time.Now().In(loc)
	trend := make([]models.DailyProgress, 0, days)
	for offset := days - 1; offset >= 0; offset-- {
		day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -offset)
		entry, ok := counts[day.Format("2006-01-02")]
		if !ok {
			entry = models.DailyProgress{Date: day}
		}
		if entry.ByExercise == nil {
			entry.ByExercise = map[string]int{}
		}
		trend = append(trend, entry)
	}
	return trend
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
