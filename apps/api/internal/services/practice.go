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

// Answer is one reported question result.
type Answer struct {
	Exercise string
	Correct  bool
	Chosen   *string
	Expected *string
	// Prompt is the question payload, when the client knows it. It is what makes
	// the mistake notebook able to replay the same question later.
	Prompt []byte
}

// RecordAnswer stores the outcome of a single answered question and keeps the
// mistake notebook in step: a wrong answer with a prompt records a mistake, and
// a later correct answer for the same prompt clears it.
func (s *PracticeService) RecordAnswer(ctx context.Context, userID uuid.UUID, answer Answer) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO practice_records (user_id, exercise, correct, chosen, expected) VALUES ($1, $2, $3, $4, $5)`,
		userID, answer.Exercise, answer.Correct, answer.Chosen, answer.Expected,
	)
	if err != nil {
		return fmt.Errorf("failed to record answer: %w", err)
	}

	if len(answer.Prompt) == 0 {
		return nil
	}

	if answer.Correct {
		return s.clearMistake(ctx, userID, answer)
	}
	return s.recordMistake(ctx, userID, answer)
}

// recordMistake upserts the notebook entry for a wrong answer. The fingerprint is
// md5 of the canonical jsonb text, which Postgres renders deterministically, so
// equal questions collapse into one entry with a growing wrong count.
func (s *PracticeService) recordMistake(ctx context.Context, userID uuid.UUID, answer Answer) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO mistakes (user_id, exercise, fingerprint, prompt, answer)
		VALUES ($1, $2, md5($3::jsonb::text), $3, $4)
		ON CONFLICT (user_id, exercise, fingerprint) DO UPDATE SET
			wrong_count = mistakes.wrong_count + 1,
			last_wrong_at = NOW(),
			resolved_at = NULL
	`, userID, answer.Exercise, answer.Prompt, answer.Expected)
	if err != nil {
		return fmt.Errorf("failed to record mistake: %w", err)
	}
	return nil
}

func (s *PracticeService) clearMistake(ctx context.Context, userID uuid.UUID, answer Answer) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE mistakes SET resolved_at = NOW()
		WHERE user_id = $1 AND exercise = $2 AND fingerprint = md5($3::jsonb::text) AND resolved_at IS NULL
	`, userID, answer.Exercise, answer.Prompt)
	if err != nil {
		return fmt.Errorf("failed to clear mistake: %w", err)
	}
	return nil
}

// ListMistakes returns the open notebook entries, newest miss first.
func (s *PracticeService) ListMistakes(ctx context.Context, userID uuid.UUID, exercise string) ([]models.Mistake, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, exercise, prompt, answer, wrong_count, last_wrong_at
		FROM mistakes
		WHERE user_id = $1 AND resolved_at IS NULL AND ($2 = '' OR exercise = $2)
		ORDER BY last_wrong_at DESC
	`, userID, exercise)
	if err != nil {
		return nil, fmt.Errorf("failed to list mistakes: %w", err)
	}
	defer rows.Close()

	mistakes := []models.Mistake{}
	for rows.Next() {
		var entry models.Mistake
		if err := rows.Scan(&entry.ID, &entry.Exercise, &entry.Prompt, &entry.Answer, &entry.WrongCount, &entry.LastWrongAt); err != nil {
			return nil, fmt.Errorf("failed to read mistakes: %w", err)
		}
		mistakes = append(mistakes, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to list mistakes: %w", err)
	}

	return mistakes, nil
}

// ResolveMistake removes a notebook entry by hand and reports whether it existed.
func (s *PracticeService) ResolveMistake(ctx context.Context, userID, id uuid.UUID) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`UPDATE mistakes SET resolved_at = NOW() WHERE id = $1 AND user_id = $2 AND resolved_at IS NULL`,
		id, userID,
	)
	if err != nil {
		return false, fmt.Errorf("failed to resolve mistake: %w", err)
	}
	return tag.RowsAffected() > 0, nil
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
