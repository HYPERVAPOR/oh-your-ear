package services

import (
	"context"
	"errors"
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

// LocalizedText is copy that exists in both languages.
type LocalizedText struct {
	ZH string
	EN string
}

// Level is one question-set level: a parameter set plus the round it runs.
type Level struct {
	Slug      string
	Position  int
	Title     LocalizedText
	Questions int
	PassMark  float64
	Config    []byte
}

// LevelSet is a named group of levels for one module.
type LevelSet struct {
	Slug        string
	Module      string
	Title       LocalizedText
	Description LocalizedText
	Position    int
	Levels      []Level
}

// LevelCatalog returns the official catalog, ordered, with each set's levels.
func (s *PracticeService) LevelCatalog(ctx context.Context) ([]LevelSet, error) {
	sets := []LevelSet{}
	rows, err := s.pool.Query(ctx, `
		SELECT slug, module, title_zh, title_en,
		       COALESCE(description_zh, ''), COALESCE(description_en, ''), position
		FROM level_sets
		WHERE is_official
		ORDER BY position, slug
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list level sets: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var set LevelSet
		if err := rows.Scan(&set.Slug, &set.Module, &set.Title.ZH, &set.Title.EN,
			&set.Description.ZH, &set.Description.EN, &set.Position); err != nil {
			return nil, fmt.Errorf("failed to read level set: %w", err)
		}
		set.Levels = []Level{}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to list level sets: %w", err)
	}

	for index := range sets {
		levelRows, err := s.pool.Query(ctx, `
			SELECT slug, position, title_zh, title_en, questions, pass_mark, config
			FROM levels
			WHERE set_id = (SELECT id FROM level_sets WHERE slug = $1)
			ORDER BY position
		`, sets[index].Slug)
		if err != nil {
			return nil, fmt.Errorf("failed to list levels: %w", err)
		}

		for levelRows.Next() {
			var level Level
			if err := levelRows.Scan(&level.Slug, &level.Position, &level.Title.ZH, &level.Title.EN,
				&level.Questions, &level.PassMark, &level.Config); err != nil {
				levelRows.Close()
				return nil, fmt.Errorf("failed to read level: %w", err)
			}
			sets[index].Levels = append(sets[index].Levels, level)
		}
		if err := levelRows.Err(); err != nil {
			levelRows.Close()
			return nil, fmt.Errorf("failed to list levels: %w", err)
		}
		levelRows.Close()
	}

	return sets, nil
}

// LevelModule returns the module a level belongs to, and whether it exists.
func (s *PracticeService) LevelModule(ctx context.Context, slug string) (string, bool, error) {
	var module string
	err := s.pool.QueryRow(ctx, `
		SELECT level_sets.module FROM levels
		JOIN level_sets ON level_sets.id = levels.set_id
		WHERE levels.slug = $1
	`, slug).Scan(&module)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, fmt.Errorf("failed to look up level: %w", err)
	}

	return module, true, nil
}

// LevelProgress is what one user has done with one question-set level.
type LevelProgress struct {
	LevelID      string
	Module       string
	Passed       bool
	BestAccuracy float64
}

// RecordLevelResult stores a finished level attempt, keeping the best accuracy and
// never downgrading a pass. The pass decision is made here so the rule lives in one
// place rather than in whatever client reported the round.
func (s *PracticeService) RecordLevelResult(ctx context.Context, userID uuid.UUID, levelID, module string, correct, total int, passMark float64) (LevelProgress, error) {
	accuracy := 0.0
	if total > 0 {
		accuracy = float64(correct) / float64(total)
	}
	passed := total > 0 && accuracy >= passMark

	var progress LevelProgress
	err := s.pool.QueryRow(ctx, `
		INSERT INTO level_progress (user_id, level_id, module, passed, best_accuracy, passed_at)
		VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 THEN NOW() ELSE NULL END)
		ON CONFLICT (user_id, level_id) DO UPDATE SET
			passed = level_progress.passed OR EXCLUDED.passed,
			best_accuracy = GREATEST(level_progress.best_accuracy, EXCLUDED.best_accuracy),
			passed_at = COALESCE(level_progress.passed_at, EXCLUDED.passed_at),
			updated_at = NOW()
		RETURNING level_id, module, passed, best_accuracy
	`, userID, levelID, module, passed, accuracy).Scan(
		&progress.LevelID, &progress.Module, &progress.Passed, &progress.BestAccuracy,
	)
	if err != nil {
		return LevelProgress{}, fmt.Errorf("failed to record level result: %w", err)
	}

	return progress, nil
}

// ListLevelProgress returns every level this user has attempted.
func (s *PracticeService) ListLevelProgress(ctx context.Context, userID uuid.UUID) ([]LevelProgress, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT level_id, module, passed, best_accuracy
		FROM level_progress
		WHERE user_id = $1
		ORDER BY module, level_id
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list level progress: %w", err)
	}
	defer rows.Close()

	progress := []LevelProgress{}
	for rows.Next() {
		var entry LevelProgress
		if err := rows.Scan(&entry.LevelID, &entry.Module, &entry.Passed, &entry.BestAccuracy); err != nil {
			return nil, fmt.Errorf("failed to read level progress: %w", err)
		}
		progress = append(progress, entry)
	}

	return progress, rows.Err()
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

// UpdatePlan creates or replaces a user's study plan, and records today's goal so
// the calendar can judge this day later on its own terms.
func (s *PracticeService) UpdatePlan(ctx context.Context, userID uuid.UUID, dailyGoal int, focusExercises []string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO daily_goals (user_id, day, goal)
		VALUES ($1, (NOW() AT TIME ZONE $3)::date, $2)
		ON CONFLICT (user_id, day) DO UPDATE SET goal = EXCLUDED.goal
	`, userID, dailyGoal, s.loc.String())
	if err != nil {
		return fmt.Errorf("failed to record today's goal: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
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
	Solved       int
	Correct      int
	Streak       int
	Achievements []models.Achievement
	ByExercise   map[string]models.ExerciseStats
	Daily        []models.DailyProgress
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

	streak, err := s.Streak(ctx, userID)
	if err != nil {
		return nil, err
	}
	stats.Streak = streak
	stats.Achievements = achievements(stats.Solved, streak)

	return stats, nil
}

// Streak counts consecutive practised days ending today, or yesterday when
// today has no practice yet: a streak should not read as broken at breakfast.
func (s *PracticeService) Streak(ctx context.Context, userID uuid.UUID) (int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT (created_at AT TIME ZONE $2)::date AS day
		FROM practice_records
		WHERE user_id = $1
		ORDER BY day DESC
	`, userID, s.loc.String())
	if err != nil {
		return 0, fmt.Errorf("failed to read the practice calendar: %w", err)
	}
	defer rows.Close()

	days := []time.Time{}
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			return 0, fmt.Errorf("failed to read the practice calendar: %w", err)
		}
		days = append(days, day)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("failed to read the practice calendar: %w", err)
	}

	return streakFrom(days, time.Now().In(s.loc)), nil
}

// streakFrom walks practised days, which must be sorted newest first.
func streakFrom(days []time.Time, now time.Time) int {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	streak := 0
	expected := today
	var last time.Time
	for _, day := range days {
		day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, now.Location())

		// Several answers on one day are still one practised day.
		if streak > 0 && day.Equal(last) {
			continue
		}

		// The first entry may be yesterday: today is simply still ahead of the user.
		if streak == 0 && day.Equal(today.AddDate(0, 0, -1)) {
			expected = today.AddDate(0, 0, -1)
		}
		if !day.Equal(expected) {
			break
		}

		streak++
		last = day
		expected = expected.AddDate(0, 0, -1)
	}

	return streak
}

// achievementSpecs are the milestones, in display order. Each one is a single
// cumulative counter, so the list can be evaluated without storing unlock state.
var achievementSpecs = []struct {
	id     string
	target int
}{
	{id: "firstSteps", target: 1},
	{id: "warmUp", target: 20},
	{id: "century", target: 100},
	{id: "marathon", target: 500},
}

// StreakAchievementTarget is the streak milestone, kept apart because its
// counter comes from the practice calendar rather than from the answer totals.
const StreakAchievementTarget = 7

// achievements evaluates the milestone list from the cumulative counters.
func achievements(solved, streak int) []models.Achievement {
	list := make([]models.Achievement, 0, len(achievementSpecs)+1)
	for _, spec := range achievementSpecs {
		list = append(list, models.Achievement{ID: spec.id, Progress: solved, Target: spec.target})
	}

	return append(list, models.Achievement{
		ID:       "streakWeek",
		Progress: streak,
		Target:   StreakAchievementTarget,
	})
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

// DailyBucket is one day of practice history, judged against the goal in force then.
type DailyBucket struct {
	Date    time.Time
	Solved  int
	Correct int
	Goal    int
}

// DailyHistory is the calendar data: a bucket per day plus the streaks.
type DailyHistory struct {
	Days          []DailyBucket
	CurrentStreak int
	LongestStreak int
}

// DailyHistoryForUser returns one bucket per local day for the requested span,
// oldest first, filling days with no practice. Past days are judged against the
// goal recorded for that day; days from before goals were recorded fall back to
// the current goal.
func (s *PracticeService) DailyHistoryForUser(ctx context.Context, userID uuid.UUID, days int) (*DailyHistory, error) {
	plan, err := s.GetPlan(ctx, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().In(s.loc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.loc).AddDate(0, 0, -(days - 1))

	counts := map[string]DailyBucket{}
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc('day', created_at AT TIME ZONE $2)::date AS day,
		       COUNT(*)::int,
		       COUNT(*) FILTER (WHERE correct)::int
		FROM practice_records
		WHERE user_id = $1 AND created_at >= $3
		GROUP BY 1
	`, userID, s.loc.String(), start)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate daily history: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var bucket DailyBucket
		if err := rows.Scan(&bucket.Date, &bucket.Solved, &bucket.Correct); err != nil {
			return nil, fmt.Errorf("failed to read daily history: %w", err)
		}
		counts[bucket.Date.Format("2006-01-02")] = bucket
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to aggregate daily history: %w", err)
	}

	goals := map[string]int{}
	goalRows, err := s.pool.Query(ctx,
		`SELECT day, goal FROM daily_goals WHERE user_id = $1 AND day >= $2`, userID, start)
	if err != nil {
		return nil, fmt.Errorf("failed to read recorded goals: %w", err)
	}
	defer goalRows.Close()

	for goalRows.Next() {
		var day time.Time
		var goal int
		if err := goalRows.Scan(&day, &goal); err != nil {
			return nil, fmt.Errorf("failed to read recorded goals: %w", err)
		}
		goals[day.Format("2006-01-02")] = goal
	}
	if err := goalRows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read recorded goals: %w", err)
	}

	history := &DailyHistory{Days: make([]DailyBucket, 0, days)}
	run, longest := 0, 0
	for offset := days - 1; offset >= 0; offset-- {
		day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.loc).AddDate(0, 0, -offset)
		key := day.Format("2006-01-02")

		bucket := counts[key]
		bucket.Date = day
		if goal, ok := goals[key]; ok {
			bucket.Goal = goal
		} else {
			bucket.Goal = plan.DailyGoal
		}

		if bucket.Solved > 0 {
			run++
			if run > longest {
				longest = run
			}
		} else {
			run = 0
		}

		history.Days = append(history.Days, bucket)
	}

	// The current streak counts back from today, or from yesterday when today is
	// still ahead of the user.
	history.CurrentStreak = 0
	for i := len(history.Days) - 1; i >= 0; i-- {
		if history.Days[i].Solved > 0 {
			history.CurrentStreak++
			continue
		}
		if i == len(history.Days)-1 {
			continue
		}
		break
	}
	history.LongestStreak = longest

	return history, nil
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
