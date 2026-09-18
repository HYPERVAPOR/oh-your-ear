package api

import (
	"net/http"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/auth"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/middleware"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/models"
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

	err := s.practice.RecordAnswer(c.Request.Context(), userID, string(body.Exercise), body.Correct, body.Chosen, body.Expected)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to record answer"})
		return
	}

	c.Status(http.StatusCreated)
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

	c.JSON(http.StatusOK, PracticeStats{
		Solved:     stats.Solved,
		Correct:    stats.Correct,
		Accuracy:   accuracy(stats.Solved, stats.Correct),
		ByExercise: byExercise,
		Daily:      daily,
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
