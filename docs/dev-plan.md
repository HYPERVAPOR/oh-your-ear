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
- **description**: Plays a 3–8 note melody from the configured range and key set, at a configurable playback speed.
- **depends on**: 1.2

### 5.2 Melody answering / re-practice

- **status**: 🟢 done
- **description**: A real question: four candidate melodies are offered, the three distractors each differing from the correct one by one or two notes. Each option shows a mini piano roll plus its note names; choosing one gives the usual feedback, is scored, and is reported to the statistics and the mistake notebook with the melody as its prompt. Notebook entries re-enter the module seeded with the exact melody (`?melody=`), and answering it correctly clears the entry. The old reveal-notation buttons are gone: the notation is what you choose between now.
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

- **status**: 🟢 done
- **description**: `POST /auth/code` issues a 6-digit code (60s per-address cooldown, 5-attempt lock, 10min TTL, hashed at rest, plus a per-IP budget of 10/hour); `POST /auth/login` and `POST /auth/register` verify it, upsert the user, and issue access + refresh tokens. Delivery is pluggable via `MAIL_DRIVER`: `log` (default, development) writes to the server log, `smtp` sends through a relay over STARTTLS using `net/smtp`. Delivery failures are logged but still answer 204, so the response cannot leak whether an address exists.
- **depends on**: none

### 7.2 Google OAuth login

- **status**: 🟢 done
- **description**: OAuth callback with CSRF state cookie, account linking.
- **depends on**: none

### 7.3 Protected routes

- **status**: 🟢 done
- **description**: Backend per-handler JWT guard on `/auth/me`; web `/login` page, `RequireAuth` guard, `/me` account page, and session restore from the refresh cookie on reload. Logout revokes the refresh token server-side (`jti` row in `revoked_tokens`, checked by `/auth/refresh`) instead of only clearing the cookie, and `TRUSTED_PROXIES` decides whether `X-Forwarded-For` is believed.
- **depends on**: 7.1

---

## M8 Study Plans & Progress

### 8.1 Study plan model and API

- **status**: 🟢 done
- **description**: `study_plans` (daily question goal + focus modules) and `practice_records` (one row per answered question, with chosen/expected for the mistake notebook later). Endpoints: `GET /me/plan`, `PUT /me/plan`, `POST /me/practice-records`. All five modules report from the web client; guests never report, and a failed report is swallowed so practice is unaffected. Rhythm is judged per round rather than per answer. "Today" is the calendar day in `APP_TIMEZONE` (default Asia/Shanghai), not UTC. Home shows today's progress, `/me` edits the plan.
- **depends on**: 7.3

### 8.2 Progress statistics dashboard

- **status**: 🟢 done
- **description**: `GET /me/stats` returns all-time totals, accuracy, a per-module breakdown, and a 14-day daily trend (`TREND_DAYS` in `services/practice.go`) with empty days zero-filled. The trend covers the last 14 local days while the totals stay all-time. The `/me` page renders three figures (solved, accuracy, active days), a bar-per-day trend with a dated range under it, and share bars per module — plain divs, no chart library.
- **depends on**: 8.1

---

## M9 Mistake Notebook

### 9.1 Record wrong answers

- **status**: 🟢 done
- **description**: `POST /me/practice-records` takes an optional `prompt` (the question payload: notes, interval, chord type, rhythm pattern). A wrong answer carrying a prompt is upserted into `mistakes` keyed by `md5(exercise + prompt::jsonb::text)`, bumping `wrong_count`; answering that same prompt correctly later resolves the entry. All four judged modules send the prompt; a wrong answer without one is only counted in the statistics.
- **depends on**: 7.3

### 9.2 Review mode

- **status**: 🟢 done
- **description**: `/mistakes` lists the open entries with per-module filters (`GET /me/mistakes?exercise=`), each showing the question, the localised correct answer and the miss count, plus manual removal (`DELETE /me/mistakes/{id}`) and a re-practice link. Re-practice re-enters the exercise seeded with the exact same question through URL params (`?note=`, `?root=&interval=`, `?root=&type=`), so the attempt is scored and reported like any other and getting it right clears the entry automatically. Rhythm has no per-question seed yet, so it links to the module without one.
- **depends on**: 9.1

---

## M10 Streaks & Achievements

### 10.1 Daily streak tracking

- **status**: 🟢 done
- **description**: Derived from `practice_records`, no extra table: a day counts once it has one answered question, and the streak walks back from today (or yesterday, so it does not read as broken before the day's first practice) through consecutive practised local days. Exposed as `streak` on `GET /me/stats`; the walk is unit-tested (`TestStreakFrom`).
- **depends on**: 7.3

### 10.2 Achievement badges

- **status**: 🟢 done
- **description**: Five milestones (1 / 20 / 100 / 500 questions and a 7-day streak) evaluated on read from the same counters — no unlock table, because every criterion is monotonic. `GET /me/stats` returns `id` / `progress` / `target` / `achieved` and the wording lives in the locales (`achievements.<id>`), so the API stays language-free. Accuracy-based badges need a compound rule ("at least N questions at X%") and stay in the backlog.
- **depends on**: 10.1

---

## M10b Backlog

### 10b.1 Accuracy-based achievements

- **status**: ⚪ backlog
- **description**: Badges such as "100 answers at 90% accuracy" need a compound rule (a minimum count plus a rate), unlike the current single-counter milestones. Add when the existing five stop being enough.

---

## M11 i18n & Theme Polish

### 11.1 Full Chinese / English coverage

- **status**: 🟢 done
- **description**: All user-facing strings live in `src/i18n/locales/*/common.json`, including interval and chord option labels (ids like `5P` / `major` are no longer rendered raw) and the play button's `aria-label` / `title`. `pnpm --filter @oh-your-ear/web check:i18n` enforces locale key parity and that every referenced key exists; it runs in CI. `<html lang>` follows the active language.
- **depends on**: none

### 11.2 Light / dark theme refinement

- **status**: 🟢 done
- **description**: Answer feedback and option highlighting go through the `--success` / `--destructive` tokens (`feedbackPill` / `optionHighlight` in `src/lib/utils.ts`) instead of hand-picked Tailwind hues; both tokens are tuned per theme for AA contrast as text and as 10% pills. `color-scheme` follows the active theme, and an inline script in `index.html` applies the stored theme before first paint so dark users no longer see a white flash.
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

- **status**: 🟡 doing
- **description**: Artifacts are in place and verified locally: hardened `compose/compose.yml` (api and db publish no ports, `JWT_SECRET` / `POSTGRES_PASSWORD` / `FRONTEND_URL` have no fallback and refuse to start when unset), `compose/compose.tls.yml` + `Caddyfile` for automatic Let's Encrypt TLS, `compose/backup.sh` (pg_dump with retention, verified by restoring into a scratch database) and a runbook in [deploy.md](./deploy.md). What is left is server-side and needs a host, domain and secrets: DNS, `.env`, first deploy, cert issuance, and the cron entry for backups.
- **depends on**: 12.2

---

## M13 Random Test Mode & Exercise Configuration

### 13.1 Random test mode with per-exercise configuration

- **status**: 🟢 done
- **description**: Exercises are endless random tests with only in-session scoring; each exercise has configurable scope (white/black keys, allowed intervals/chord types, melody length, rhythm durations/length).
- **depends on**: M1, M2–M6
