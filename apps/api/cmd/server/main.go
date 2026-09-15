package main

import (
	"log"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/db"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/handlers"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	pool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	r := gin.Default()

	r.GET("/health", handlers.HealthHandler)
	r.GET("/api/health", handlers.HealthHandler)

	log.Printf("server listening on %s", cfg.ServerAddr)
	if err := r.Run(cfg.ServerAddr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
