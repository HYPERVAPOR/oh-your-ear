# Development Plan

> 项目开发路线图，所有功能按模块拆分，每个条目状态为以下四种之一：
>
> - `todo` / 🔴 没做
> - `doing` / 🟡 在做
> - `done` / 🟢 做完了
> - `backlog` / ⚪ 暂不实现，待需要时重新评估
>
> 每次开发前参照本文件，开发后更新状态。

---

## M1 Audio Playback Chain

### 1.1 Tone.js + Salamander piano samples integration

- **status**: 🟢 done
- **description**: Initialize Tone.js, load Salamander samples, support offline fallback.
- **depends on**: none

### 1.2 Basic "play note" button

- **status**: 🟢 done
- **description**: A reusable button that plays a given note and handles audio context resume.
- **depends on**: 1.1

### 1.3 Latency and volume configuration

- **status**: ⚪ backlog
- **description**: Tone.js latency hint is unnecessary on modern devices; master volume control can be added later if users ask.
- **depends on**: 1.2

---

## M2 Single Note Exercise

### 2.1 Exercise UI layout

- **status**: 🟢 done
- **description**: Note buttons, feedback area, score counter.
- **depends on**: none

### 2.2 Answer validation

- **status**: 🟢 done
- **description**: Compare played note with user selection using `tonal`.
- **depends on**: 2.1, 1.2

---

## M3 Interval Exercise

### 3.1 Interval playback

- **status**: 🟢 done
- **description**: Play two notes sequentially and identify interval.
- **depends on**: 1.2

### 3.2 Interval answer options

- **status**: 🟢 done
- **description**: Display interval names, validate answer.
- **depends on**: 3.1

---

## M4 Chord Exercise

### 4.1 Chord playback

- **status**: 🟢 done
- **description**: Play block chords using Tone.js polyphony.
- **depends on**: 1.2

### 4.2 Chord recognition UI

- **status**: 🟢 done
- **description**: Show chord type options and validate.
- **depends on**: 4.1

---

## M5 Melody Exercise

### 5.1 Melody playback

- **status**: 🟢 done
- **description**: Play short random melodies.
- **depends on**: 1.2

### 5.2 Melody replay / notation

- **status**: 🟢 done
- **description**: Allow replay; optionally show simple notation.
- **depends on**: 5.1

---

## M6 Rhythm Exercise

### 6.1 Rhythm playback

- **status**: 🟢 done
- **description**: Use Tone.js transport to play rhythmic patterns.
- **depends on**: 1.2

### 6.2 Rhythm tap input

- **status**: 🟢 done
- **description**: Capture user tap timing and compare to pattern.
- **depends on**: 6.1

---

## M7 Authentication & User Accounts

### 7.1 Email verification code login

- **status**: 🔴 todo
- **description**: Send code, verify, issue JWT + refresh token.
- **depends on**: none

### 7.2 Google OAuth login

- **status**: 🟢 done
- **description**: OAuth callback, account linking.
- **depends on**: 7.1

### 7.3 Protected routes

- **status**: 🟡 doing
- **description**: Frontend guards and backend JWT middleware.
- **depends on**: 7.1

---

## M8 Study Plans & Progress

### 8.1 Study plan model and API

- **status**: 🔴 todo
- **description**: CRUD for study plans, daily goals.
- **depends on**: 7.3

### 8.2 Progress statistics dashboard

- **status**: 🔴 todo
- **description**: Visualize accuracy, exercise distribution, trends.
- **depends on**: 8.1

---

## M9 Mistake Notebook

### 9.1 Record wrong answers

- **status**: 🔴 todo
- **description**: Store wrong answer history per user.
- **depends on**: 7.3

### 9.2 Review mode

- **status**: 🔴 todo
- **description**: Filter exercises to previously wrong items.
- **depends on**: 9.1

---

## M10 Streaks & Achievements

### 10.1 Daily streak tracking

- **status**: 🔴 todo
- **description**: Track consecutive practice days.
- **depends on**: 7.3

### 10.2 Achievement badges

- **status**: 🔴 todo
- **description**: Unlock badges based on milestones.
- **depends on**: 10.1

---

## M11 i18n & Theme Polish

### 11.1 Full Chinese / English coverage

- **status**: 🔴 todo
- **description**: All user-facing strings extracted to i18n files.
- **depends on**: none

### 11.2 Light / dark theme refinement

- **status**: 🔴 todo
- **description**: Consistent color tokens, system preference sync.
- **depends on**: none

### 11.3 Client-side routing

- **status**: 🟢 done
- **description**: React Router integration with per-exercise routes and browser history support.
- **depends on**: none

---

## M12 Deployment & CI/CD

### 12.1 Podman Compose local dev setup

- **status**: 🟢 done
- **description**: `compose/compose.dev.yml` with web, api, db services.
- **depends on**: none

### 12.2 CI pipeline

- **status**: 🟢 done
- **description**: GitHub Actions with lint, format, typecheck, build, OpenAPI drift checks.
- **depends on**: 12.1

### 12.3 Production deployment

- **status**: 🔴 todo
- **description**: Self-hosted server, reverse proxy, SSL, backups.
- **depends on**: 12.2

---

## M13 Random Test Mode & Exercise Configuration

### 13.1 Random test mode with per-exercise configuration

- **status**: 🟢 done
- **description**: Exercises are endless random tests with only in-session scoring; each exercise has configurable scope (white/black keys, allowed intervals/chord types, melody length, rhythm durations/length).
- **depends on**: M1, M2–M6
