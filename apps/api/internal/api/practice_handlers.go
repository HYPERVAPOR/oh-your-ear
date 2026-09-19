package api

import (
	"encoding/json"
	"net/http"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/middleware"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// GetStudyPlan handles GET /me/plan.
func (s *Server) GetStudyPlan(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	plan, err := s.practice.GetPlan(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load study plan"})
		return
	}

	progress, err := s.practice.TodayProgress(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load today's progress"})
		return
	}

	c.JSON(http.StatusOK, toStudyPlan(plan, progress))
}

// UpdateStudyPlan handles PUT /me/plan.
func (s *Server) UpdateStudyPlan(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	var body UpdateStudyPlanJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}
	if body.DailyGoal < 1 || body.DailyGoal > 500 {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "dailyGoal must be between 1 and 500"})
		return
	}

	focus := []string{}
	if body.FocusExercises != nil {
		for _, exercise := range *body.FocusExercises {
			if !exercise.Valid() {
				c.JSON(http.StatusBadRequest, ErrorResponse{Error: "unknown exercise kind"})
				return
			}
			focus = append(focus, string(exercise))
		}
	}

	ctx := c.Request.Context()
	if err := s.practice.UpdatePlan(ctx, userID, body.DailyGoal, focus); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to save study plan"})
		return
	}

	plan, err := s.practice.GetPlan(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load study plan"})
		return
	}
	progress, err := s.practice.TodayProgress(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load today's progress"})
		return
	}

	c.JSON(http.StatusOK, toStudyPlan(plan, progress))
}

// CreatePracticeRecord handles POST /me/practice-records.
func (s *Server) CreatePracticeRecord(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	var body CreatePracticeRecordJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}
	if !body.Exercise.Valid() {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "unknown exercise kind"})
		return
	}

	answer := services.Answer{
		Exercise: string(body.Exercise),
		Correct:  body.Correct,
		Chosen:   body.Chosen,
		Expected: body.Expected,
	}
	if body.Prompt != nil {
		prompt, err := json.Marshal(*body.Prompt)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid prompt"})
			return
		}
		answer.Prompt = prompt
	}

	if err := s.practice.RecordAnswer(c.Request.Context(), userID, answer); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to record answer"})
		return
	}

	c.Status(http.StatusCreated)
}

// ListMistakes handles GET /me/mistakes.
func (s *Server) ListMistakes(c *gin.Context, params ListMistakesParams) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	exercise := ""
	if params.Exercise != nil {
		exercise = string(*params.Exercise)
		if !params.Exercise.Valid() {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "unknown exercise kind"})
			return
		}
	}

	mistakes, err := s.practice.ListMistakes(c.Request.Context(), userID, exercise)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load mistakes"})
		return
	}

	items := make([]Mistake, 0, len(mistakes))
	for _, entry := range mistakes {
		var prompt *map[string]interface{}
		if len(entry.Prompt) > 0 {
			decoded := map[string]interface{}{}
			if err := json.Unmarshal(entry.Prompt, &decoded); err == nil {
				prompt = &decoded
			}
		}

		items = append(items, Mistake{
			Id:          entry.ID,
			Exercise:    ExerciseKind(entry.Exercise),
			Prompt:      prompt,
			Answer:      entry.Answer,
			WrongCount:  entry.WrongCount,
			LastWrongAt: entry.LastWrongAt.UTC(),
		})
	}

	c.JSON(http.StatusOK, items)
}

// ResolveMistake handles DELETE /me/mistakes/{id}.
func (s *Server) ResolveMistake(c *gin.Context, id openapi_types.UUID) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	removed, err := s.practice.ResolveMistake(c.Request.Context(), userID, uuid.UUID(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to remove mistake"})
		return
	}
	if !removed {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "mistake not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListLevelProgress handles GET /me/levels.
func (s *Server) ListLevelProgress(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	progress, err := s.practice.ListLevelProgress(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load level progress"})
		return
	}

	items := make([]LevelProgress, 0, len(progress))
	for _, entry := range progress {
		items = append(items, LevelProgress{
			LevelId:      entry.LevelID,
			Module:       ExerciseKind(entry.Module),
			Passed:       entry.Passed,
			BestAccuracy: entry.BestAccuracy,
		})
	}

	c.JSON(http.StatusOK, items)
}

// RecordLevelResult handles POST /me/levels/{id}.
func (s *Server) RecordLevelResult(c *gin.Context, id string) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	var body RecordLevelResultJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request body"})
		return
	}
	if !body.Module.Valid() || body.Total < 0 || body.Correct < 0 || body.Correct > body.Total {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid result"})
		return
	}
	if body.PassMark < 0 || body.PassMark > 1 {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "passMark must be between 0 and 1"})
		return
	}
	if id == "" || len(id) > 64 {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid level id"})
		return
	}

	progress, err := s.practice.RecordLevelResult(
		c.Request.Context(), userID, id, string(body.Module), body.Correct, body.Total, body.PassMark,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to record level result"})
		return
	}

	c.JSON(http.StatusOK, LevelProgress{
		LevelId:      progress.LevelID,
		Module:       ExerciseKind(progress.Module),
		Passed:       progress.Passed,
		BestAccuracy: progress.BestAccuracy,
	})
}

// GetPracticeStats handles GET /me/stats.
func (s *Server) GetPracticeStats(c *gin.Context) {
	userID, ok := s.requireUser(c)
	if !ok {
		return
	}

	stats, err := s.practice.StatsForUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to load statistics"})
		return
	}

	byExercise := make(map[string]ExerciseStats, len(stats.ByExercise))
	for exercise, entry := range stats.ByExercise {
		byExercise[exercise] = ExerciseStats{
			Solved:   entry.Solved,
			Correct:  entry.Correct,
			Accuracy: accuracy(entry.Solved, entry.Correct),
		}
	}

	daily := make([]DailyProgress, 0, len(stats.Daily))
	for _, entry := range stats.Daily {
		daily = append(daily, DailyProgress{
			Date:    openapi_types.Date{Time: entry.Date},
			Solved:  entry.Solved,
			Correct: entry.Correct,
		})
	}

	achievements := make([]Achievement, 0, len(stats.Achievements))
	for _, entry := range stats.Achievements {
		achievements = append(achievements, Achievement{
			Id:       entry.ID,
			Progress: entry.Progress,
			Target:   entry.Target,
			Achieved: entry.Achieved(),
		})
	}

	c.JSON(http.StatusOK, PracticeStats{
		Solved:       stats.Solved,
		Correct:      stats.Correct,
		Accuracy:     accuracy(stats.Solved, stats.Correct),
		Streak:       stats.Streak,
		Achievements: achievements,
		ByExercise:   byExercise,
		Daily:        daily,
	})
}

// accuracy returns a 0..1 fraction, or 0 when nothing was solved yet.
func accuracy(solved, correct int) float64 {
	if solved == 0 {
		return 0
	}
	return float64(correct) / float64(solved)
}

// requireUser runs the access-token guard and returns the caller's user ID.
func (s *Server) requireUser(c *gin.Context) (uuid.UUID, bool) {
	if !middleware.Auth(c, s.cfg.JWTSecret) {
		return uuid.Nil, false
	}

	value, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return uuid.Nil, false
	}

	claims, ok := value.(*auth.TokenClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return uuid.Nil, false
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid user"})
		return uuid.Nil, false
	}

	return userID, true
}

func toStudyPlan(plan *models.StudyPlan, progress *models.DailyProgress) StudyPlan {
	focus := make([]ExerciseKind, 0, len(plan.FocusExercises))
	for _, exercise := range plan.FocusExercises {
		focus = append(focus, ExerciseKind(exercise))
	}

	byExercise := progress.ByExercise
	if byExercise == nil {
		byExercise = map[string]int{}
	}

	return StudyPlan{
		DailyGoal:      plan.DailyGoal,
		FocusExercises: focus,
		Today: DailyProgress{
			Date:       openapi_types.Date{Time: progress.Date},
			Solved:     progress.Solved,
			Correct:    progress.Correct,
			ByExercise: &byExercise,
		},
	}
}

// Valid reports whether the value is one of the five known exercise kinds.
func (e ExerciseKind) Valid() bool {
	switch e {
	case SingleNote, Interval, Chord, Melody, Rhythm:
		return true
	default:
		return false
	}
}
