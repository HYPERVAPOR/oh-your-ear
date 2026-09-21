<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/nameplate-dark.png" />
  <img src=".github/assets/nameplate-light.png" alt="Oh Your Ear" width="152" />
</picture>

## Train your ear, anywhere.

Ear training in a browser tab: **single notes, intervals, chords, melodies and rhythms**, on whatever you happen to be holding. **You do not need an account to start** — practise now, sign in later if you want the progress kept.

**[Practise at ohyourear.com →](https://ohyourear.com)**

[![CI](https://github.com/HYPERVAPOR/oh-your-ear/actions/workflows/ci.yml/badge.svg)](https://github.com/HYPERVAPOR/oh-your-ear/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

---

### The five drills

| Drill | What it asks |
| --- | --- |
| **Single Note** | One pitch. Name it. |
| **Interval** | Two pitches. Name the distance. |
| **Chord** | A stack of notes. Name its quality. |
| **Melody** | A short phrase. Pick the one you heard. |
| **Rhythm** | A figure. Pick the pattern you heard. |

Each module has its own settings — register, how many choices, how the phrase is played — so the same drill goes from "three options" to "name it cold". Three ways to practise them: endless random questions, a daily goal, or a graded set that walks from easy to hard.

### There is an instrument on the landing page

Below the copy sits a piano roll you can play with before signing up for anything: drag the blocks, double-click to write or delete a note, hit play and watch the spectrum. It is the product's argument in miniature, and it is why that page has no second button.

### Practise first, sign in later

- **As a guest**, every drill is open and scores last for the session.
- **With an account**, you get study plans, progress statistics, a mistake notebook that collects what you keep getting wrong, streaks and achievements.

Signing in is an email code or Google, and nothing else.

### It fits the way you already work

- **Desktop, tablet, phone** — one layout that holds up at 390px.
- **Light, dark, or follow your system** — the piano keys stay a piano's black and white in both.
- **English and 简体中文**, switched from the header.

### Run it yourself

The whole thing is in this repository: both front ends, the Go API, the schema. One compose file brings it up, and the runbook is in [`docs/deploy.md`](./docs/deploy.md).

### What it is built with

React 19 · TypeScript · Vite · Tailwind v4 · Tone.js with real piano samples, in front of Go, Gin and PostgreSQL. The reasoning behind each choice is in [`docs/tech-spec.md`](./docs/tech-spec.md).

### Contributing

Issues and pull requests are welcome. [`AGENTS.md`](./AGENTS.md) has the working agreement, the requirements live in [`docs/prd.md`](./docs/prd.md), and [`docs/development.md`](./docs/development.md) gets you running locally.

### License

[Apache License 2.0](./LICENSE), with third-party attributions in [NOTICE](./NOTICE).

If this is useful to you, a star helps the next person find it.
