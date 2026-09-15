package main

import (
	"fmt"
	"log"

	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/api"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/config"
	"github.com/HYPERVAPOR/oh-your-ear/apps/api/internal/db"
	"github.com/gin-gonic/gin"
)

func run() error {
	cfg := config.Load()

	pool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer pool.Close()

	r := gin.Default()

	server := api.NewServer()
	// The route prefix must match `servers` in openapi.yaml, which the web client
	// (src/api/client.ts) and nginx both assume.
	api.RegisterHandlersWithOptions(r, server, api.GinServerOptions{BaseURL: "/api/v1"})

	log.Printf("server listening on %s", cfg.ServerAddr)
	if err := r.Run(cfg.ServerAddr); err != nil {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
