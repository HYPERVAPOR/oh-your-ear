# Development Guide

This document explains how to set up the development environment for Oh Your Ear.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **State**: Zustand + TanStack Query
- **Audio**: Tone.js + Salamander piano samples
- **Backend**: Go 1.26 + Gin + PostgreSQL
- **Monorepo**: pnpm workspaces + Turborepo
- **Container Runtime**: Podman

## Project Structure

```
oh-your-ear/
├── apps/
│   ├── web/            # React frontend
│   └── api/            # Golang backend
├── compose/            # Podman Compose files
├── docs/               # PRD + tech spec + this doc
└── package.json        # pnpm workspace root
```

## Local Development

Requirements:
- Podman + podman-compose

All services run in containers. You edit code with your own editor on the host.

```bash
# start web + api + db
podman compose -f compose/compose.dev.yml up -d
```

Services:

| Service | Host URL | Container |
| --- | --- | --- |
| Web | http://localhost:5173 | `oh-your-ear-web-1` |
| API | http://localhost:8080 | `oh-your-ear-api-1` |
| API health | http://localhost:8080/health | `oh-your-ear-api-1` |
| Postgres | localhost:5432 | `oh-your-ear-db-1` |

### View logs

```bash
podman compose -f compose/compose.dev.yml logs -f web
podman compose -f compose/compose.dev.yml logs -f api
podman compose -f compose/compose.dev.yml logs -f db
```

### Run a command inside a container

```bash
# front-end shell
podman exec -it oh-your-ear-web-1 bash

# back-end shell
podman exec -it oh-your-ear-api-1 bash
```

### Stop everything

```bash
podman compose -f compose/compose.dev.yml down
```

## Manual Development (without containers)

Requirements:
- Node.js 24.16.0
- pnpm 10.15.0
- Go 1.26.4
- PostgreSQL 17

```bash
pnpm install
cd apps/api && go mod download && cd ../..

# start your local Postgres, then:
podman compose -f compose/compose.dev.yml up db -d

pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:8080
- API health: http://localhost:8080/health

## Common Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start all apps in dev mode (manual mode) |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all apps |
| `pnpm typecheck` | Type-check all apps |
| `pnpm clean` | Remove build artifacts |

## Production Build

```bash
pnpm build
```

## Production Deployment

```bash
cp .env.example .env
# edit .env with your secrets
podman compose -f compose/compose.yml up --build -d
```

## Base Images

- Build: `node:24.16.0-slim`, `golang:1.26.4-bookworm`
- Runtime: `nginx:1.27.5-alpine`, `gcr.io/distroless/static-debian12`
- Database: `postgres:17.4-alpine`
