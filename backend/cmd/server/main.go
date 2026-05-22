package main

import (
	"log"

	"github.com/kangzyz/Doub/backend/docs"
	"github.com/kangzyz/Doub/backend/internal/cli"
	"github.com/kangzyz/Doub/backend/internal/shared/buildinfo"
)

// @title DOUB Chat API
// @version 0.1.0
// @description DOUB Chat 后端 API 文档
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	docs.SwaggerInfo.Version = buildinfo.ResolveVersion()
	if err := cli.Run(); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
