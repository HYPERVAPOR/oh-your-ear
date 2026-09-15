# Oh Your Ear

A responsive web-based ear training application.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS v4
- **State**: Zustand + TanStack Query
- **Audio**: Tone.js + Salamander piano samples
- **i18n**: i18next
- **Backend**: Golang + Gin + PostgreSQL
- **Auth**: JWT + Google OAuth + email verification code
- **Monorepo**: pnpm workspaces + Turborepo
- **Deployment**: Self-hosted server + Podman Compose
- **Local Dev**: Dev Container + Podman

## Project Structure

```
oh-your-ear/
├── apps/
│   ├── web/            # React frontend
│   └── api/            # Golang backend
├── compose/            # Podman Compose files
├── .devcontainer/      # Dev Container config
├── docs/               # PRD + tech spec
└── package.json        # pnpm workspace root
```

## Quick Start

### With Dev Container (recommended)

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
   devcontainer exec --workspace-folder . bash
   ```
3. Inside the container:
   ```bash
   pnpm dev          # starts web + api via turbo
   ```

### Manual Local Development

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

- Web: http://localhost:5173
- API: http://localhost:8080
- API health: http://localhost:8080/health

## Build & Deploy

```bash
# production build
pnpm build

# deploy with Podman Compose
cp .env.example .env
# edit .env with your secrets
podman compose -f compose/compose.yml up --build -d
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all apps |
| `pnpm typecheck` | Type-check all apps |

## Documentation

- [Product Requirements](./docs/prd.md)
- [Tech Stack](./docs/tech-spec.md)
- [Agent Guide](./AGENTS.md)
