# Oh Your Ear - Agent Project Guide

## Project Overview

Oh Your Ear is a responsive web-based ear training application. It covers five core exercise modules: single notes, intervals, chords, melodies, and rhythms.

- Guest mode allows practicing all basic exercises without signing in.
- Signed-in users unlock study plans, progress statistics, a mistake notebook, streaks, and achievements.
- Initial login methods: email verification code + Google OAuth.
- Supports multiple languages (Chinese and English) and light/dark theme switching.

## Core Documents

| Document | Path | Description |
| --- | --- | --- |
| Product Requirements | [docs/prd.md](./docs/prd.md) | Feature requirements, user stories, module definitions, milestones |
| Tech Stack Confirmation | [docs/tech-spec.md](./docs/tech-spec.md) | Final tech stack, deployment approach, development environment |

## Tech Stack at a Glance

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **State**: Zustand + TanStack Query
- **Audio**: Tone.js + Salamander piano samples
- **Music Theory**: tonal
- **i18n**: i18next
- **Backend**: Golang + Gin + PostgreSQL (pgx + sqlc)
- **Auth**: JWT + Google OAuth + email verification code
- **Deployment**: Self-hosted server + Docker Compose
- **Local Dev**: VS Code Dev Container + Podman/Docker

## Agent Working Principles

1. Read [docs/prd.md](./docs/prd.md) first to confirm scope before adding features.
2. Implement according to the constraints in [docs/tech-spec.md](./docs/tech-spec.md).
3. Prefer existing dependencies; explain the reason when introducing new ones.
4. Keep code simple and add comments in English or Chinese for critical logic.
