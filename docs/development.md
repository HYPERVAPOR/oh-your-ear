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
├── .devcontainer/      # Dev Container config
├── docs/               # PRD + tech spec + this doc
└── package.json        # pnpm workspace root
```

## Option 1: Dev Container (recommended)

The dev container only provides the runtime (Node/Go/Postgres). **Keep using your own editor on the host** to edit code; the project directory is mounted into the container.

1. Install the [Dev Container CLI](https://github.com/devcontainers/cli):
   ```bash
   npm install -g @devcontainers/cli
   ```
2. Start the dev container with Podman:
   ```bash
   export DOCKER_HOST=unix:///run/user/$(id - u)/podman/podman.sock
   podman system service --time=0 &

   # make podman available as 'docker' for the CLI
   mkdir -p ~/.local/bin
   ln -sf $(which podman) ~/.local/bin/docker
   export PATH="$HOME/.local/bin:$PATH"

   devcontainer up --workspace-folder .
   ```
3. In another terminal, run the dev servers inside the container:
   ```bash
   devcontainer exec --workspace-folder . bash
   # inside the container:
   pnpm dev          # starts web + api via turbo
   ```
4. Use your host editor to edit files normally. Changes are synced into the container via bind mount.

- Web: http://localhost:5173
- API: http://localhost:8080
- API health: http://localhost:8080/health

## Option 2: Manual Local Development

Requirements:
- Node.js 24.16.0
- pnpm 10.15.0
- Go 1.26.4
- PostgreSQL 17
- Podman + podman-compose

```bash
# install dependencies
pnpm install
cd apps/api && go mod download

# start database
podman compose -f compose/compose.dev.yml up db -d

# start dev servers
pnpm dev
```

### Run only the frontend

```bash
pnpm --filter @oh-your-ear/web dev
```

### Run only the backend

Requires the database to be running first.

```bash
pnpm --filter @oh-your-ear/api dev
```

## Common Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start all apps in dev mode |
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
