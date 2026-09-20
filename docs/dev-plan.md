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

- **issue**: #76
- **status**: 🟢 done
- **description**: Live: landing on the apex domain, app on the app subdomain (both Vercel, auto-deployed from main), Go API + Postgres self-hosted. The app reaches the API through a Vercel rewrite, so the browser stays same-origin and no CORS or cross-site cookie was needed. The API runs on a **shared** server that already serves other sites behind host nginx + certbot, so it was deployed with `compose.yml` alone (api + db, api bound to loopback) plus an additive nginx vhost and a `certonly` certificate — the Caddy overlay stays for a dedicated box. Verified end to end: public health check, email-code request, real login, `Set-Cookie` carrying `Secure`, and `/auth/mock` answering 404 on the public path. Still to come: SMTP credentials (codes currently go to the container log) and Google OAuth client credentials.

## M14 Question Sets (登录独有)

### 14.1 Rounds and the summary page

- **status**: 🟢 done
- **description**: A round is a fixed number of questions followed by a summary (correct count, accuracy, elapsed time, per-question review), reachable with `?round=N`. The summary offers another round or home, and nudges guests to sign in. This is the foundation the question-set mode stands on, and it is what makes the PRD's "round completion ≥80%" measurable.
- **depends on**: M1–M6

### 14.2 Level definitions and progress

- **status**: 🟢 done
- **description**: A level is a *parameter set*, not an abstract difficulty score: pitch range, option count, playback mode, allowed intervals/chord types/durations, plus the round size and the pass mark. Progress lives in `level_progress` (user, module, level, passed at, best accuracy) so it follows the account across devices. Reporting a round result decides the pass and unlocks the next level.
- **depends on**: 14.1

### 14.3 Question-set UI

- **status**: 🟢 done
- **description**: `/levels` lists the five chains for signed-in users with per-level state (passed with best accuracy, open, locked) and an entry point on the home page. A level opens the normal practice screen with `?level=`, which pins the exercise scope and the round size, so there is no parallel code path. The pass verdict and the best accuracy come back from the API, and the summary links to the next level. NOTE: the practice screens still show their settings panel while a level runs — replacing it with a read-only level line is the remaining polish.
- **depends on**: 14.2

### 14.4 Level catalog in the database

- **issue**: #63
- **status**: 🟢 done
- **description**: Levels are product content that must grow and be curated, so they moved out of `lib/levels.ts` into `level_sets` / `levels` (config as jsonb, bilingual titles, `slug` for stable URLs, `position`). The official catalog is seeded idempotently from Go (`db.SeedLevels`) and served by the public `GET /levels/sets`; the client fetches it and keeps only types and pure decisions. `level_progress.level_id` kept its slug as the key and gained a foreign key to `levels(slug)`, so no progress row had to move.
- **depends on**: 14.2

### 14.5 Collections and folders

- **issue**: #64
- **status**: 🟢 done
- **description**: Any level can be collected. `collections` (owner, name, position, `is_default`) + `collection_items`, so a level can sit in several folders. API for listing, creating, renaming, deleting folders and adding/removing levels, with the default folder created lazily and protected from rename/delete; its name is empty and the client renders it in the reader's language. UI: a bookmark control on every level opening the folders as checkboxes (plus inline folder creation) and a bookmarks page listing each folder's levels with rename, delete and remove. Signed-in only, synced.
- **depends on**: 14.4

---

## M15 Daily Practice (登录独有)

### 15.1 Daily practice session

- **issue**: #60
- **status**: 🟢 done
- **description**: The plan stops being a number that is only measured. A session is generated from it: work out how many questions are left today, draw them from the focus modules (rotating module per round), and run it on the existing round machinery. The summary shows progress against the daily goal and offers to continue with the next focus module. Guests see the mode and are asked to sign in.
- **depends on**: 14.1

### 15.2 Daily history

- **issue**: #61
- **status**: 🟢 done
- **description**: A calendar heatmap of the last year built from `practice_records` aggregated by local day: three tiers (goal met / partly done / nothing), plus current and longest streak. Each day is judged against the goal that was in force then — `daily_goals` records a row whenever the plan is saved, so changing the goal does not rewrite history. `GET /me/daily?days=371` returns the buckets.
- **depends on**: 8.1

### 15.3 Fold the study plan into daily practice

- **issue**: #62
- **status**: 🟢 done
- **description**: The plan's settings became the daily practice settings (`/me` holds them, `/daily` acts on them, and each links to the other); 练习模式 is renamed 随机练习 everywhere; the home page lays out all three modes as bands. The calendar history is 15.2.
- **depends on**: 15.1

---

## M13 Random Test Mode & Exercise Configuration

### 13.1 Random test mode with per-exercise configuration

- **status**: 🟢 done
- **description**: **随机练习**（Random practice, formerly 练习模式）is endless and stateless: no rounds, no goal, only in-session scoring; each exercise has configurable scope (white/black keys, range, allowed intervals/chord types, melody length, rhythm durations/length). The other two modes are M14 (题单模式) and M15 (每日练习).
- **depends on**: M1, M2–M6

---

## M16 Visual pass: recording-studio vocabulary

### 16.1 Flatten: no gradient glows, square corners

- **issue**: #69
- **status**: 🟢 done
- **description**: First step of the visual pass (PRD 7.1.1). Remove the radial glow orbs (`.orb`, its tokens, seven call sites) so surfaces are flat, and set the radius scale to zero so containers and controls are square; the module colour dots stay round because a dot is a marker, not a container. Module colours themselves stay — they carry module identity.
- **depends on**: —

### 16.2 Make the exercise screen feel like an instrument

- **issue**: #69
- **status**: 🔴 todo
- **description**: The one control the whole product depends on is currently a flat circle. Give the play control key-cap tactility with a real press state, drive a waveform/level meter from the actual audio (an `AnalyserNode` on the Tone.js output — real data, not decoration, which also answers "is there sound coming out"), switch counters and readouts to monospace, and replace the flat progress box with an arc.
- **depends on**: 16.1

### 16.3 Home hero and per-module micro-visuals
- **issue**: #69
- **status**: 🟡 doing
- **description**: Done: the module cards became a tight six-cell rack (8px gaps, 2 columns on phones and 3 on wider screens, a track-colour strip along each panel's top edge, and 错题重练 filling the sixth cell so the rectangle closes instead of leaving a gap); the header controls became a row of 32px icon keys; the hero became one full screen, two columns, flush left, with a native scroll-snap pull towards the rack. The hero then moved out of the app entirely — see M17 — so what remains here is the per-module micro-visual (single note = pulse dot, interval = two dots joined, chord = stacked peaks, melody = contour, rhythm = beat grid).
- **depends on**: 16.1

## M17 Split the front end: landing site and app

### 17.1 Workspace split: `packages/shared` + `apps/landing`, app home becomes the hub

- **issue**: #76
- **status**: 🟢 done
- **description**: Two applications in one pnpm workspace, deployable to separate hosts later (PRD 7.1.2). Extracted the parts that must not drift — design tokens, fonts, base element styles, the button variants, the language/theme preference store and its application, the icon keys, the i18next bootstrap — into `packages/shared`, and created `apps/landing` with the hero that used to sit on the app home. The app home is now the practice hub (rack, today, daily, level chains, login card) and still serves guests. The i18n key check moved to `scripts/check-i18n.mjs` and runs for both sites in CI. Dev: landing on 5174, app unchanged on 5173.
- **depends on**: —

### 17.2 Cross-site preferences and session
- **issue**: #76
- **status**: 🟢 done
- **description**: Preferences cross the two hosts (PRD 7.1.2). One cookie on the parent domain — never a per-site copy as well, because the more specific host-only cookie reads first and would hide the other site's change — falling back to host-only when the browser refuses the shared scope, which is what Chrome does on `localhost`. Verified in a browser across two origins: the app writes, the landing (empty localStorage) reads, the landing writes, the app reads the new value despite its own stale copy. **The session needs no change at all**: because Vercel proxies `/api` for the app, every cookie in the auth flow (refresh, OAuth state) is set on the app's own host and stays host-only, so no `COOKIE_DOMAIN` was needed.
- **depends on**: 17.1
### 17.3 Deployment: two hosts, one API
- **issue**: #76
- **status**: 🟢 done
- **description**: Front ends on Vercel, API and Postgres on the VPS. The app's `/api` is a Vercel rewrite back to the origin (`apps/web/vercel.json`, with `no-store` so token responses are never edge-cached), which is what keeps the browser same-origin and let the API stay untouched: no CORS, no cross-site cookie, and the Google callback is registered on the app host so the OAuth state and refresh cookies land on the same origin. The API container stays the only thing Caddy fronts (one certificate, one host), the web image and its nginx config are gone, and `docs/deploy.md` now describes the topology, DNS records, the two Vercel projects and the env split.
- **depends on**: 17.1, 17.2

## M18 SEO: the landing site's search and share surface

### 18.1 Adaptive favicon and share image

- **issue**: #86
- **status**: 🟡 doing
- **description**: The brand ear mark as a favicon with a backing plate, switching with the reader's colour scheme (black glyph on white in light, white on black in dark) from a single SVG whose own `@media (prefers-color-scheme: dark)` rule does the switching. Plus a 1200×630 share image in the product's vocabulary for `og:image` / `twitter:image`, referenced by absolute URL.
- **depends on**: —

### 18.2 Metadata, robots.txt, llms.txt, sitemap.xml

- **issue**: #86
- **status**: 🟡 doing
- **description**: Title and description sized not to be truncated, canonical URL, Open Graph and Twitter card tags, light/dark `theme-color`, JSON-LD describing the application, a robots.txt that points at a sitemap, and an llms.txt in the llmstxt.org shape so a model reading the site gets the product in one file.
- **depends on**: —

### 18.3 Keep the app out of the index

- **issue**: #86
- **status**: 🟡 doing
- **description**: `app.<domain>` is a login-shaped application and duplicate content next to the landing page: give it `<meta name="robots" content="noindex">` and a `robots.txt` that disallows everything, so search engines index the pitch and not the practice screens.
- **depends on**: —

### 18.4 Prerender the landing page

- **issue**: #86
- **status**: ⚪ backlog
- **description**: The landing page ships an empty HTML shell and renders in the browser, so a crawler that does not execute JavaScript sees no copy at all. Prerendering (or SSG) would put the headline, the description and the links into the first response. Not done now because search engines do execute JS and the page is a single screen; revisit when the page grows or when organic traffic is being measured.
- **depends on**: 18.2

