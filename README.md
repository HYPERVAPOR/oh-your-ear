# Oh Your Ear

A responsive, web-based ear training application for musicians.

Train your ear with single notes, intervals, chords, melodies, and rhythms — on desktop, tablet, or phone.

## Features

- **Five exercise modules**: Single Note, Interval, Chord, Melody, Rhythm
- **Real piano samples** powered by Tone.js
- **Responsive design** — works on desktop, tablet, and mobile
- **Light / dark / system theme** support
- **Multi-language** support (English & 简体中文 at launch)
- **Guest mode** — no sign-in required for basic practice
- **Sign-in benefits** — study plans, progress stats, mistake notebook, streaks, and achievements

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4
- **State**: Zustand + TanStack Query
- **Audio**: Tone.js + Salamander piano samples
- **Music Theory**: tonal
- **Backend**: Go + Gin + PostgreSQL
- **Auth**: JWT + Google OAuth + email verification
- **Deployment**: Self-hosted server + Podman Compose

## Live Demo

> Coming soon — deployment instructions are in [`docs/tech-spec.md`](./docs/tech-spec.md).

## Documentation

| Document | Description |
| --- | --- |
| [`docs/prd.md`](./docs/prd.md) | Product requirements and feature roadmap |
| [`docs/tech-spec.md`](./docs/tech-spec.md) | Final tech stack and architecture |
| [`docs/development.md`](./docs/development.md) | Local development and Dev Container setup |
| [`AGENTS.md`](./AGENTS.md) | Guide for AI agents working on this repo |

## License

MIT
