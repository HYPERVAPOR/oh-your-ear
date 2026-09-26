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
- **status**: 🟢 done
- **description**: The brand ear mark as a favicon with a backing plate, switching with the reader's colour scheme (black glyph on white in light, white on black in dark) from a single SVG whose own `@media (prefers-color-scheme: dark)` rule does the switching. Plus a 1200×630 share image in the product's vocabulary for `og:image` / `twitter:image`, referenced by absolute URL.
- **depends on**: —

### 18.2 Metadata, robots.txt, llms.txt, sitemap.xml

- **issue**: #86
- **status**: 🟢 done
- **description**: Title and description sized not to be truncated, canonical URL, Open Graph and Twitter card tags, light/dark `theme-color`, JSON-LD describing the application, a robots.txt that points at a sitemap, and an llms.txt in the llmstxt.org shape so a model reading the site gets the product in one file.
- **depends on**: —

### 18.3 Keep the app out of the index

- **issue**: #86
- **status**: 🟢 done
- **description**: `app.<domain>` is a login-shaped application and duplicate content next to the landing page: give it `<meta name="robots" content="noindex">` and a `robots.txt` that disallows everything, so search engines index the pitch and not the practice screens.
- **depends on**: —

### 18.5 One language for the machines

- **issue**: —
- **status**: 🟢 done
- **description**: Everything a crawler, a model or a link preview reads is English: title, description, OG/Twitter cards, JSON-LD, `robots.txt`, `llms.txt`, and the text drawn on the share image, which was the last Chinese piece. The copy a *reader* sees still follows their own preference, and `i18n` rewrites `<html lang>` once it has hydrated. The share card's source is now committed at `apps/landing/og-card.html`: the first card was rendered from a template that never existed in the repo, so changing one word meant rebuilding it by measuring pixels blind.
- **depends on**: 18.1, 18.2

### 18.4 Prerender the landing page

- **issue**: #86
- **status**: ⚪ backlog
- **description**: The landing page ships an empty HTML shell and renders in the browser, so a crawler that does not execute JavaScript sees no copy at all. Prerendering (or SSG) would put the headline, the description and the links into the first response. Not done now because search engines do execute JS and the page is a single screen; revisit when the page grows or when organic traffic is being measured.
- **depends on**: 18.2

## M19 The hero's instrument

### 19.1 Editable piano roll

- **issue**: #91
- **status**: 🟢 done
- **description**: The landing page's right column becomes a one-bar piano roll you can edit, the way a DAW's is edited: 4/4 in sixteen steps, twelve pitch rows with the black keys shaded, click to select, double click to write or remove a note, drag the body to move, drag an edge to change the length, everything snapped to the grid, chords allowed, and a button that writes a random bar. Pure DOM 2D — the 3D take was dropped because a hairline inside a 3D transform comes back dotted (see `memory/2026-09-20-thin-lines-inside-css-3d-go-dotted.md`). Drags never enter React state: the dragged element is moved directly and committed on release. The snapping, clamping and the random bar live in `apps/landing/src/lib/roll.ts` and are covered by `node --test`. It opens on a transposed transcription of the intro's second bar of *Never Gonna Give You Up* rather than an empty grid, the transport is three welded 32px icon keys (play, random, reset), and the phrase plays at 90bpm so each step is audible.
- **depends on**: —

### 19.2 Playback and a playhead

- **issue**: #91
- **status**: 🟢 done
- **description**: A play button that sounds the whole bar with a playhead moving across it. `playNote(frequency, when)` schedules every note on the audio clock up front, so no timer decides when a note lands; one requestAnimationFrame loop moves the playhead and stops itself at the end of the bar plus the `audioNow()` export it reads the clock from. Also: the left-hand keys are buttons that audition their own note. Stop is a real stop: every playback routes through its own bus (`createBus()`), so dropping the bus silences the notes already queued on the audio clock — cancelling the timer alone only moved the playhead. See `memory/2026-09-21-scheduled-audio-needs-a-bus-to-stop.md`. A real `AnalyserNode` sits in front of the destination, so the transport row carries a log-spaced trace that wakes on the first note through it (the bar or an auditioned key) and puts itself out about 0.7s after the sound stops; its mapping and its drawing are covered by `node --test`. The row underneath is one 32px hairline bar cut into cells — keys, spectrum, readout — sharing one outline, one height and the site's 8px rhythm, aligned edge to edge with the roll above.
- **depends on**: 19.1

### 19.3 The default phrase: two bars from a MIDI file

- **issue**: #102
- **status**: 🟢 done
- **description**: The roll opens on a two-bar phrase transcribed from the 191-byte MIDI file the reader supplied, replacing the single transposed bar of the intro it used to open on. Two things had to move to fit it on a sixteenth grid. The source sits on C3–F4, so it is transposed up 12 semitones, which puts its lowest note on the roll's C4 and its highest on F5 — six rows above the old ceiling, so the pitch axis goes from twelve rows to eighteen, and the keybed, the row shading and the drag maths all follow `LOW`/`HIGH` instead of assuming an octave. And the turn at the end of bar one is four 32nds, which a sixteenth grid cannot hold: the two notes that fall between steps are dropped, so the descent reads F5 → D5 into the downbeat. The phrase is 32 steps wide, so `STEPS_PER_BAR` is now the unit and `STEPS` is two of them; the random button fills both bars, the readout follows, and the playhead sweeps 6 seconds at 80bpm. The phrase is asserted to be its own `normalize` output — the default obeys the same no-overlap rule as anything the reader drags. Note the file is not the same transcription as the 17549-byte one used earlier: its pitch set has no A♭/D♭. `OPENING_BAR` and `randomBar` are renamed `OPENING_PHRASE` and `randomPhrase`, and the note and key labels derive their octave — a hard-coded "4" would have called F5 "F4".
- **depends on**: 19.1

## M20 GitHub SEO: the repository's own search surface

### 20.1 A README that sells, and metadata that gets found

- **issue**: #104
- **status**: 🟢 done
- **description**: The repository's search surface was empty — no description, no topics, a homepage URL missing its scheme, only GitHub's ten default labels — and the README was 43 lines of feature and tech-stack lists that still said "Live Demo: Coming soon" about a site that has been live for days. Now: an English marketing README that opens on the brand nameplate (the same mark-and-wordmark plate as the top left of both sites, rendered from `apps/landing/nameplate.html` into `.github/assets/nameplate-{light,dark}.png` and chosen with `<picture>` for the reader's colour scheme), a one-line tagline, a working link to the live site, the five drills as a table, the guest-versus-account promise, the landing page's playable roll as the hook, and the tech stack compressed to a single line pointing at `docs/tech-spec.md`. The repository itself got a description built around the words people actually search, a homepage with its scheme restored, twenty topics covering both ear-training terms and the implementation stack, and eleven area labels (landing/app/api/audio/ui/i18n/infra/seo/performance/security/polish) so the existing flow can label work by where it lands. The social preview can only be set by hand — GitHub has no API for it — and is recorded in PRD §7.6 as a manual step.
- **depends on**: —

---

## M21 首页重构为 dashboard

### 21.1 登录后回到触发登录的页面

- **issue**: #106
- **status**: 🟢 done
- **description**: `?next=` 成为唯一的回跳机制：登录页读 `next`，`RequireAuth` 与首页各登录入口跳 `/login?next=…`。`RequireAuth` 现在只传 `location.pathname`，查询串丢失，所以 `/exercise/interval?level=xx` 登录回来会掉关卡参数。`next` 必须做同源校验（以 `/` 开头、不以 `//` 开头），否则是开放重定向。Google 流程把 `next` 带过 OAuth 回路（`/api/v1/auth/google?next=…` 存进 state cookie），回调重定向到它而不是固定的 `FrontendURL + "/#access_token=…"`；顺带不再把 access token 塞进 URL hash —— 回调已经设了 refresh cookie，客户端 `restoreSession()` 本来就会用它换 token，带着反而与 PRD 7.1.2「不在 URL 里传任何令牌」冲突。
- **depends on**: 7.1

### 21.2 首页三段结构

- **issue**: #107
- **status**: 🟢 done
- **description**: 首页改成 dashboard（PRD 7.1.4）：第一段左右布局 —— 左侧邮箱与显眼的「开始每日训练」（游客同一位置放登录引导，布局不跳），右侧今日进度与热力图；第二、三段是两个 2×3 网格。`daily.tsx` 的 `startSession()` 逻辑（还算差几题、从练得最少的重点模块开一轮、一轮最多 20 题）搬到首页。顶栏给游客一个**带字不带图标**的登录按钮，放在图标组外侧、与其他控件同为 32px 高。
- **depends on**: 21.1

### 21.3 一个棋盘，两个 tab：Learn 与 Random

- **issue**: #107 / #117
- **status**: 🟢 done
- **description**: 五个模块一个棋盘（`grid-cols-2 lg:grid-cols-5`），Learn / Random test 用选项卡切换 —— 两边的格子内容完全同构，原本画了两遍。Learn 每格带闯关进度条（已通关数 / 总关卡数）加 `0/4`；Random 不带进度条（随机练习没有可显示的量），格子里只有模块名。选项卡沿用热力图那套压条词汇，取代原来的两个 h2；题单入口骑在选项卡行右侧（不挂网格下面，否则只在一个档出现会让页高抖动）。未登录时进度条显示 0、不显示假数据，点击才提示登录并回跳。**收藏夹与错题本的入口移进账号卡**（`today-panel` 底部发丝线之下），它们属于账号、不属于练习。文案一并清过（#115）：账号卡只剩值 / 动作 / 两个入口（删掉 `accountLabel` / `startHint` / `goalMet` / `loginCtaHint`，`guestIdentity` 缩成「未登录」），关链格子只剩模块名 + 进度条 + `0/4`，随机格只剩模块名，练习页顶部那句模块说明也删了。
- **depends on**: 21.2, 14.4, 14.5

### 21.5 头像：Google / 像素默认 / 允许上传

- **issue**: #118
- **status**: 🟢 done
- **description**: 账号卡与 `/me` 显示头像，三来源按优先级：用户上传的 > Google 给的 `picture`（`users.avatar_url` 早就存着了，只是前端一直没画）> **生成的 identicon**（`lib/avatar.ts` 的 `avatarPattern` + `avatarColors`，都由账号 id 的 hash 决定：5×5 镜像方块 + 一个色相的深浅两档；`components/avatar.tsx` 渲染成 `grid-cols-5 grid-rows-5`，颜色 inline 不跟主题走；单测覆盖尺寸、镜像、同 id 稳定 / 不同 id 不同、颜色格式与稳定性）。上传：`POST /me/avatar`（multipart）、`GET /me/avatar`（字节，带 ETag 与 `immutable` 缓存）、`DELETE /me/avatar`（退回登录方式的头像）；新表 `user_avatars(user_id PK, image BYTEA, mime, updated_at)` —— 与 `users` 分开，列用户时不会拖着字节走，也不引入对象存储。校验在服务端（`validateAvatar`：PNG / JPEG、16×16–1024×1024、≤ 512KB，格式由字节判定，白名单外一律 400），缩放裁剪在浏览器（canvas → 256×256 JPEG）。账号卡同时补上「我的账号」按钮（进 `/me`），`调整每日计划` 随之下线。
- **depends on**: 21.2

### 21.4 热力图四档倍率

- **issue**: #107
- **status**: 🟢 done
- **description**: 热力图加日 / 周 / 月 / 年四个 tab，都是同一张日历的四种倍率，数据只有 `GET /me/daily` 一个来源，不新增接口：日档是当天目标的进度条（`已答 / 目标`，答满即满），周档是本周七天，月档是本月日历（30/31 个格子，随年份），年档是一年的热力图。**格子永远是一天，永远按那天自己的目标分档**，没有相对强度。星期缩写用英文。四个函数（`dayPercent` / `week` / `month` / `year`）在 `lib/heatmap.ts`，带表驱动单测。**日档是进度条**（复用闯关格子的那一套，8px 高、填充达标绿 `bg-success`；百分比逻辑在 `lib/heatmap.ts` 的 `dayPercent`，带单测）；**周 / 月共用 20px 格子**（2px 间距，周档就是月档的一行、同一个网格）；四档都铺满盒子宽度（七列均分、格子居中）；**年是第二个倍率**、格子随卡片宽度流式（`minmax(8px, 1fr)`，桌面 8px、宽卡最多 10px）；四个视图左边缘对齐（去掉年的 32px 星期名竖栏与缩进，年份视图因此不再横向溢出）；轴的字号跟着格子走（12px / 10px）。绘制在 `components/heatmap-views.tsx`，容器（数据 / tab / 图例）在 `components/practice-heatmap.tsx`。
- **depends on**: 15.2

### 21.6 删掉每日练习页

- **issue**: #107
- **status**: 🟢 done
- **description**: 今日进度、开始按钮、热力图都已在首页，计划设置在 `/me`，`/daily` 没有存在意义了：删掉页面、路由与 `/daily` 的入口；`study-plan-form` 里指向它的链接改到首页；相关文案 key 迁进首页命名空间，中英同步。
- **depends on**: 21.2

## M22 落地页第二屏

### 22.1 免费与开源，footer 归位

- **issue**: #110
- **status**: 🟢 done
- **description**: 落地页 hero 之下加第二屏（PRD 7.1.5）：三句主张「开源 / 免费 / 没有额外费用」，用压条的词汇做成三个同高的格 —— 一整圈外框 + `divide-x`，不是三张卡片；不加第二个动作按钮，不用模块色。footer 落到整页末尾：内容不足一屏贴视口底，超过一屏跟在内容之后，品牌与许可证信息不在两处重复。中英文案同步。
- **depends on**: 17.1

## M23 登录屏

### 23.1 登录屏：连体 nameplate、Continue with Google、错误内联

- **issue**: #122
- **status**: 🟡 doing
- **description**: 登录页左上角改用**连体 nameplate**（PRD 7.1.9）—— 从 `app-header.tsx` 抽成 `components/nameplate.tsx`，`app-header` 与 `login` 共用（落地页那份在另一个 app 里、是静态渲染，不动）。**放在卡片内部的左上角，不另起页顶栏**；`inline-flex` 而不是 `flex`，否则在卡片里会撑成 382px 的空框。Google 入口文案改成 `Continue with Google`，前面加一个**单路径 `currentColor`** 的 Google 标记（四色版会是全页唯一的彩色）。验证码输入框与发送按钮焊成一件（`iconGroup` 那套：一圈外框 + `divide-x`，`items-stretch` 让两者等高，焦点态移到外框的 `focus-within`）—— 原来 `flex gap-2` 是两个独立控件，输入框 45px、按钮 40px。Google 标记改成**官方四色**（品牌标记是全站第二处非调色板颜色）。**错误信息内联**：`ui/field.tsx` 增加 `error` 通道，与 `hint` 共用一行（`error ?? hint`），**只要调用方传了字符串就渲染**（`hint !== undefined`，不做真值判断），行高固定 18px；登录页错误拆成 `emailError` / `codeError` 两份，各自落在自己的字段下，改输入即清掉自己那份。实测五种状态（初始 / 邮箱不合法 / 改回合法 / 验证码已发送 / 验证码错误）卡片高度都是 637px，不再抖动。同时把 `codeSentHint` 那句长尾（"验证码打印在服务端日志里"）删掉 —— 它属于 `docs/deploy.md`，留在界面上会换行，把"高度恒定"破掉。
- **depends on**: 21.2

## M23 登录屏

### 23.2 邮箱 + 密码登录

- **issue**: #125
- **status**: 🟢 done
- **description**: 按 PRD §5.10 的顺序做：**验证码证明身份，密码是之后的一把快钥匙**。API 部分：`users.password_hash TEXT NULL`（NULL = 还没有密码，同时给已有库补一条幂等的 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`）；`has_password` 在 SQL 里算成布尔塞进 `models.User`，哈希本身永不离开 service 层；bcrypt cost 12（`golang.org/x/crypto` 本来就在依赖里，只是从 indirect 提成 direct）；`POST /auth/login` 的请求体接受 `code` 或 `password` 二选一，返回完全一样；`PUT /me/password` 设置/替换（已有密码必须给旧密码，没有则用当前会话 —— 那次会话来自验证码，地址已经证明过），旧密码错给 **403** 而不是 401（调用方是已认证的，只是不记得自己的密码）；`/auth/login` 密码路按邮箱限流，**只对失败计数**（`RateLimiter` 因此拆出 `Allow` / `Hit`：成功的登录不该花自己的额度，否则攻击者烧完额度就能把本人锁在门外）；地址不存在时照样算一次哈希再丢掉，让"邮箱存不存在"无法从响应时间读出来（实测 0.178s / 0.180s）。密码策略：≥8 字符（按字符不按字节，八位中文口令同等对待）、≤72 字节（bcrypt 上限，超长拒绝不截断）、不强制组合、不强制轮换。**UI 部分**：登录页的「用验证码 / 用密码」是家页 Learn / Random 那套焊接组选项卡（`role="group"` + `aria-pressed`，默认验证码）；两种方式的卡片高度**靠构造相等** —— 都只有「邮箱 + 一个凭证字段 + 消息行」，密码输入框的高度正好等于焊接的验证码行（行高本来就是输入框定的），副标题也始终只有一行，实测两种方式都是 699px。`/me` 加 `PasswordForm`：没有密码时只有「新密码 + 设置密码」并带一句"设个密码，以后就不用每次都等邮件了"，设置成功后读回 `/auth/me` 翻成「当前密码 + 修改密码」。实测：密码错 → 401 落在那一行（1 行，高度不变）；用密码从登录页登录 → 落到 `/`；`/me` 从"只有新密码"翻成"当前密码 + 新密码"，提示从 hint 变成「已保存。」。
- **depends on**: 23.1, 21.1

### 23.3 Google 登录按邮箱认领，不另建账号

- **issue**: #124
- **status**: 🟢 done
- **description**: `UpsertGoogleUser` 原来只声明 `ON CONFLICT (google_id)`，而 `users.email` 也是 UNIQUE —— 先用验证码注册过、再用 Google 登录同一邮箱会撞 email 唯一键 → 500。改写成按顺序三段（PRD §5.10）：①按 `google_id` 命中 → 刷新建号方拥有的字段（`name` / `avatar_url` 用 `COALESCE(NULLIF(...))`，空值保留原值）；②按 `email` 命中且 `google_id IS NULL` → 挂上 google_id 认领；③邮箱已被**另一个** Google 账号占用 → `ErrEmailLinked` → 409，绝不改绑。`scanUser` 之上拆出 `findUser`（"没有这一行"是一个返回值而不是错误），唯一键冲突统一映射成 `ErrEmailLinked`。回调加 `verified_email` 检查（v2 userinfo 的字段名，discovery 文档核对过，有单测钉住拼写）。单测：解析 `verified_email`（含缺省与 false 都算未验证）、数据库支持的三段认领（`TEST_DATABASE_URL` 存在才跑，CI 无库则 skip）。
- **depends on**: 23.2

### 23.4 dev compose 的 Google 变量改成读环境

- **issue**: #129
- **status**: 🟢 done
- **description**: `compose/compose.dev.yml` 里 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URL` 原来写死成空字符串（同一份文件里邮件那组是 `${...:-}`），于是本地想试 Google 登录只能把 client secret 贴进受版本控制的文件。三个变量改成读环境，名字与本地默认值不变；`.env.example` 补上 `FRONTEND_URL` 与 `MAIL_DRIVER`（`FRONTEND_URL` 决定登录后跳哪、以及 cookie 带不带 `Secure`，模板里漏掉它就会得到"本地好用、线上 cookie 被丢"这种问题）。实测：未配置 501，`--env-file .env` 起栈后 307 到 `accounts.google.com`，Location 带 client_id 与回调地址，同时下发 `oauth_state` / `oauth_next`。
- **depends on**: 21.1
### 23.5 邮件投递加固（可用于真实中继）

- **issue**: #85
- **status**: 🟢 done
- **description**: 邮件模板：从纯文本一句改成 `multipart/alternative`（纯文本在前 + HTML），HTML 沿用产品的面板/发丝线词汇 —— 32px 等宽验证码单独一块面板、10 处内联样式、零外部资源、深色模式媒体查询带 `!important`，验证码不进主题（锁屏会显示）。主题行按 RFC 2047 编码（原来裸 UTF-8，在这个中继上碰巧能用，严格客户端会乱码），两个部件都 base64（未声明 `8BITMIME` 的中继有权弄乱裸 UTF-8）。单测：报文能被 `mime/multipart` 真正解析出来、主题编码往返、模板不含任何要联网取的东西。另外，**代码这一半**：`SMTPMailer` 原来在**中继不提供 STARTTLS 时静默降级成明文**发送，等于给中间人留了剥离升级的路子，而验证码就是被剥的那个东西；现在**公网中继必须提供 STARTTLS，否则拒绝发信**，只有私网 / loopback / link-local 中继允许明文（自建中继那类场景）。**新增 465 隐式 TLS**（国内厂商常只给这个「SSL」口）。**加超时**（`net/smtp` 自己没有超时，中继卡住会把 `POST /auth/code` 一起挂住；现在拨号带 20s 上限并给整条会话设 deadline）。补 `Date` 与 `Message-ID` 头（缺了要扣送达率，对验证码来说就是收不到）。头注入防护：`to` 是调用方给的地址，CRLF 会凭空造出调用方想要的头，现在清洗掉。验证码邮件改成**中英双语**（这个产品是双语的，猜错语言等于寄了一封没人看得懂的邮件）。启动时打一行 `mail: driver=… host=… port=… from=… auth=…`（不含密码）——发信失败只写日志、接口永远 204，所以"到底用的哪个中继"必须能从日志里读出来。单测：头与头注入、私网判断、**假中继**上的完整投递（不带 TLS 的私网中继放行；自称支持 TLS 却完不成的必须失败）。**发信改成后台**：接口不再等中继，实测 3.0–3.5s → 4.7ms，中继指向死端口时也是 3.6ms（204 从来不表示已投递，它表示不泄漏地址是否存在，所以等中继没有收益）。goroutine 不能借请求的 context（响应写完就取消了），失败照旧只写日志，并带 recover（那里的 panic 会带走整个进程，为了一封邮件不值得）。**用户侧**：`hypervapor.org` 的 Spacemail 已配好（465 隐式 TLS、完整地址作用户名、裸地址作 `SMTP_FROM`），DMARC 也已通过 Spaceship API 加到 `_dmarc`（`p=none`）。

### 23.6 退出登录弹确认框

- **issue**: #132
- **status**: 🟢 done
- **description**: 顶栏的退出图标键与 `/me` 页头的「退出」都改成弹确认框（「要退出登录吗？」）。用的是浏览器原生 `<dialog>` + `showModal()`（`components/ui/confirm-dialog.tsx`，约 50 行，无依赖）：焦点锁、Esc、背景惰性、顶层堆叠、`::backdrop` 全是平台的。自己补三件事 —— 点背景 = 取消（原生不关）、Esc 关闭（`cancel` 事件）后把状态同步回来、以及**确认之后自己关框**（只有一个 `onDismiss` 承担所有关闭路径，确认只负责干活；把这条留给调用方的话，顶栏是常驻的，从首页确认登出后框会留在屏幕上）。实测：`:modal=true`、384×139 居中（视口 1265 宽时左 441 = 精确居中）、1px `hairline-strong` 边框、backdrop `ink/40`、**焦点落在「取消」**（第一个可聚焦元素，误触 Enter 落安全侧）、Esc / 点背景 / 取消三者都关框且不登出、确认后路径回 `/`、`/me` 链接消失。**顶栏一个键都没变**（130px，不是原地变形）。两个入口各挂一个 dialog，标题 id 用 `useId()` 按实例生成（固定 id 会重复，`aria-labelledby` 可能指到隐藏的那个）。
- **depends on**: 21.1

## M24 持续部署

### 24.1 main 更新自动部署后端

- **issue**: #134
- **status**: 🟡 doing
- **description**: 前端两个 Vercel 项目本来就自动部署，后端（api + db）一直是手动的。现在 `.github/workflows/deploy.yml` 等 CI 那一轮**通过**（`workflow_run`，不是并行）再 SSH 到 VPS 执行 `compose/deploy.sh`：先 `compose/backup.sh` dump 数据库 → `up -d --build` → 健康检查（30 次 × 2s）→ **不健康就 checkout 上一个提交重建**。部署脚本进仓库（逻辑跟着版本走，workflow 只触发），密钥用 forced command 锁死成"只能签出某个提交并跑部署脚本"，host key 用预先核对的 `known_hosts` 而不是现场 `ssh-keyscan`。没配 `DEPLOY_HOST` 时明确跳过而不是每次推 main 都红。回滚逻辑有测试（`compose/deploy.test.sh`，假 podman/curl + 临时克隆，覆盖健康 / 回滚成功 / 回滚失败三条路），CI 里跑。**数据库没有迁移步骤**：schema 在启动时幂等执行，代价是 schema 变更只许增不许改删（写进 deploy.md §6）。已知粗糙处：`up -d --build` 重建容器期间有几秒不可用。
- **depends on**: 21.1

## M25 Vercel 部署额度与分支策略

### 25.1 dev 集成分支 + 按项目判断要不要构建

- **issue**: #136
- **status**: 🟢 done
- **description**: 2026-09-25 一天之内把 Vercel 免费额度（每天 100 次部署）烧光，两个项目都被 `Deployment rate limited` 挡住，于是再推 main 前端也不更新。①**`dev` 集成分支**：`git.deploymentEnabled: {dev: false}` **必须写在项目自己的 `vercel.json` 里**（仓库根那份不生效，这条查了很久，期间根目录一直有配置而 dev 照常部署）；而且它跟着 git 走，`#139` 之后 `dev` 被强推回更早的 main，配置就此从 dev 的历史里消失——**对集成分支做 `reset --hard main` 会丢掉这期间落在 main 上的 PR**，合并 main 回 dev 才安全。已在额度耗尽的窗口里验证：加上配置后推 dev，该提交上一条 Vercel 状态都没有（规则不生效时必然留下一条 rate-limited）。CI 的 push / pull_request 监听 `main` 与 `dev`，API 只在「CI 在 main 上通过」时部署。②**每个项目自己判断**：`ignoreCommand: git diff --quiet HEAD^ HEAD -- . ../../packages/shared`（退出码 0 = 跳过；`.` 是项目根，`../../packages/shared` 是共享包），实测只改后端/文档时两个前端都跳过、改 web 只建 web、改 shared 两个都建；它是否影响额度另开 issue 跟踪。③**零碎提交先推 dev**。
- **depends on**: 24.1

## M26 体验走查修复

### 26.1 账号页导航与顶栏一致、热力图去掉连续天数、滚动条不再挪动宽度

- **issue**: #141
- **status**: 🟡 doing
- **description**: 走查发现四件小事。①`/me` 没有返回入口 → 内容区左上角加 32px `←` 图标键（放内容区而不是顶栏，因为顶栏要在每个页面完全一致）。②`/me` 的顶栏与其他页面不一样（`AppHeader` 里对 `/me` 隐藏了两个图标键，页内又自带一个退出按钮）→ 删掉例外与页内按钮，退出只剩顶栏一处。③landing 与 app 切换时内容宽度横向抖动 → 实测两边容器都是 `x=120 w=1200`，差别在滚动条（落地页文档高 3526、app 首页 900）→ `html { scrollbar-gutter: stable }` 写进共享 tokens，两个站点同时生效。④热力图上的「连续 N 天 · 最长 M 天」删掉（中英两个键一起删），日历本身就是历史，连续天数只在 `/me` 统计卡里出现。
- **depends on**: 7.1.4

### 26.2 登录态恢复前先渲染骨架屏（尺寸不变）

- **issue**: #142
- **status**: 🟡 doing
- **description**: 已登录进 app 时账号卡先渲染游客态再跳成登录态。`auth-store` 已有 `initialized`，`TodayPanel` 与热力图都没看它。改成 `!initialized` 渲染与真卡片同形状的骨架，**高度不变**（卡片高度由旁边热力图决定，见 7.1.4），否则等于把一个跳变换成另一个。热力图同理（它的查询 `enabled: !!user`，也会先渲染空态）。
- **depends on**: 7.1.4

### 26.3 头像即上传入口，并在上传前校验

- **issue**: #143
- **status**: 🟡 doing
- **description**: `/me` 上头像与「上传头像」按钮是分开的两样，点头像没反应；除了 `accept` 这个提示之外没有前置校验，大图与细长条都会先被读进来。改成：点头像即选文件（按钮删掉、键盘可达）；上传前校验格式（PNG/JPEG/WebP）、体积（≤512KB，与 `MaxAvatarBytes` 同源）、长宽比（>3:1 拒绝）、能否解码，四类失败各给一条文案；校验做成 `lib/avatar.ts` 里的纯函数加单测。
- **depends on**: 5.0.3
### 26.4 骨架屏只在值得等的时候出现

- **issue**: #147
- **status**: 🟡 doing
- **description**: `#145` 的骨架屏本身没错，但实测会话恢复只用了 30ms，而 `animate-pulse` 是 2 秒一个周期——那块灰闪一下就走，看起来就是一块静止的灰斑，连动画的第一帧都走不完。两条时间规则（`lib/use-delayed.ts`）：加载超过 **100ms** 才画，一旦画出来**至少留 400ms**（只延迟不留，恢复在 100–500ms 之间时会出现"闪一下又消失"）；脉冲周期 2s → **1s**、深度 0.5 → **0.4**（`--animate-pulse` 覆盖写在共享 tokens）。快速恢复路径上实测一次骨架都不出现。第一次改成"延迟 250ms"时矫枉过正——本机 30ms 就恢复，于是骨架彻底看不见了，用户当场就问"怎么没有了"。
- **depends on**: 26.2

## M27 走查第三批：命名、徽标、形状与选项卡

### 27.1 走查第二批：命名统一、关卡徽标、返回键、点外关闭

- **issue**: #151
- **status**: 🟡 doing
- **description**: 五件事。①`Question sets` 这个名字用在 `/levels` 标题、首页入口、小结页链接三处，中英统一改成「所有关卡 / All levels」。②`ExerciseShell` 的徽标写死了「随机测试」，于是 `?level=singleNote-1` 明明在关卡模式也挂着它 —— 改成有 `?level=` 时显示那一关的名字（五类练习都把 `level` 传进壳）。③同一样东西两套叫法：接口 `/me/collections`、i18n 命名空间 `collections`、中文「收藏夹」，而路由与组件叫 `bookmarks`、文案里说「书签图标」→ 全部统一到 `collections`（页面文件与组件改名、路由 `/collections`、旧地址重定向、文案改成「收藏图标」）。④收藏夹与错题本是账号屏的子页，补上 `/me` 同款 32px `←` 返回键回 `/me`（首页账号卡里那两条只是快捷入口）。⑤`CollectMenu` 浮层原先只能再点一次图标才关：加 `lib/use-dismiss.ts`（`pointerdown` + Esc，`ref` 必须同时含触发按钮，否则关闭与按钮自己的 toggle 打架）。全仓库只有这一个浮层；顶栏退出用的原生 `<dialog>` 早就能点背景关闭，不动它。
- **depends on**: 26.1

### 27.2 热力图的今天改用菱形，取消描边

- **issue**: #152
- **status**: 🟡 doing
- **description**: 今天那格原是 1px `muted` 描边 —— 即使压到 muted，它仍是整张日历上唯一一条线，而形状闲着。改成旋转 45 度 + `scale-75` 的菱形：颜色继续按那天是否达标分档，形状独占地表示「今天」。缩放是为了几何：菱形面积只有外接正方形的一半，不缩视觉上反而更大，而对角顶点在 22px 格距里会碰到邻居的角。图例加一格说明这个形状（用「没练」那档的底色，说明形状不带颜色含义）。四档共用同一段 `square()`，周 / 月 / 年同时生效；日档是一根条、没有格子，不受影响。`DESIGN.md` 87 行与 PRD 7.1.4 同步。
- **depends on**: 7.1.4

### 27.3 `/levels` 按模块分选项卡

- **issue**: #153
- **status**: 🟡 doing
- **description**: 五条链竖着堆，想练第五条得先滚过四条。改成按模块分选项卡：`modules` 由目录数据去重得到（顺序即目录顺序，不硬编码五个模块名），选中态沿用首页 Learn / Random 与热力图四档那套焊接组（`role="group"` + `aria-pressed` + 一圈外框 + `divide-x` + `bg-surface-strong`）。窄屏五个名字横向滚动而不折行。每段的标题只在**该模块有多于一个题单**时才画 —— 选项卡已经报了模块名，再写一遍就是重复。
- **depends on**: 14.4, 7.1.4

### 27.4 首页模块格子跳对应选项卡，选项卡进 URL

- **issue**: #155
- **status**: 🟡 doing
- **description**: `/levels` 的档位原是组件内 `useState`，地址栏看不出在哪一档、也没法从别处链进来；而首页 Learn 档的格子直接进「下一关」，等于替读者挑了一关。改成：档位写进 `?module=<目录里的模块名>`（非法或缺失回退第一档），切档用 `replace`；首页 Learn 档五个格子跳 `/levels?module=<模块>`，Random 档不变（自由练习就是它的意思）；游客也直接进目录，不再先拦去登录。实测：深链 `/levels?module=interval` 打开就是音程档、点 tab 地址栏跟着变而历史条数 2→2 不变、非法值退回单音、首页点「音程」落在音程档（首关二三度）、游客时 Learn 的 href 依旧指 `/levels?module=…`。
- **depends on**: 27.3

## M28 账号三屏：登录 / 注册 / 重设密码

### 28.1 登录与注册拆页、注册渐进、忘记密码有自己的接口

- **issue**: #157
- **status**: 🟡 doing
- **description**: `/login` 原来一页干三件事（登录、注册、两种凭证切档）。拆成三页，共用同一个 `AuthCard`（铭牌、标题位、发丝线、Google、底部互跳与「返回首页」），只有表单和它上面那句话不同。①`/login` 只负责进来，两档保留，新增「忘记密码？」与「没有账户？去注册」；②`/signup` 渐进：第一步只有一个邮箱框，成功即发码进第二步（只有验证码、写着发到哪个地址、可重发、可「换个邮箱」），Google 全程在；③`/reset`：邮箱 → 验证码 + 新密码 → 直接登录。三页互跳都带 `next`。**第几步写进 URL**（`?email=`）—— 否则第二步刷新退回第一步，而重发受 60 秒冷却，手里有验证码也进不去。**服务端新增 `POST /auth/password/reset`**：`PUT /me/password` 在账号已有密码时要当前密码，而忘记密码的定义就是没有它，验证码替代当前密码，成功后直接签发会话；密码先校验再消耗验证码（密码被拒不该废掉一个码）。登录页两档实测仍然等高（732px）。
- **depends on**: 23.1, 5.10

### 28.3 删掉两句「页面自己已经说了」的说明

- **issue**: #162
- **status**: 🟡 doing
- **description**: 登录页「用密码登录，也可以直接用 Google。」与注册页「首次登录即自动创建账号。」都是看了页面就知道的事：标题「登录」下面一个密码框、一个 Google 按钮，注册页的标题就是「注册」。两句中英四键一并删掉；`AuthCard` 的 `subtitle` 改成可选，只有重设密码页还用它（那句交代验证码发到哪个地址，是页面没说过的信息）。

### 28.2 登录页只用密码，验证码只用于注册与重设

- **issue**: #159
- **status**: 🟡 doing
- **description**: 28.1 把「用验证码登录」留在登录页是错的：验证码是**证明邮箱归属**的手段，只在它被需要的地方出现 —— 注册（地址还没被证明过）与重设密码（没有当前密码可给）；日常进门该是一把键，不是每次等一封信。登录页因此只剩「邮箱 + 密码」（外加 Google），删掉选项卡、验证码输入框与发码按钮，「两种方式必须等高」那条约束也随之消失。随之改掉的：账号页设密码的提示（原来是「以后就不用每次都等邮件了」，登录已经不等邮件）改成「之后可以直接用密码登录」；PRD §5.10 的登录方式、§7.1.9 的两档与等高段落同步。没设过密码的账号走「忘记密码」设一个 —— 这条路径对“从没设过”和“忘了”都成立，故意不分家。

### 28.4 账号三屏版式：去掉铭牌、返回键、注册行内箭头

- **issue**: #163
- **status**: 🟡 doing
- **description**: 三处版式。①三个账号页卡片左上角的「OH YOUR EAR」铭牌去掉 —— 这是产品内部的表单页，不需要再自我介绍，而一行 wordmark 在只有一个输入框的卡片上是纯占地方。②卡片下方的「返回首页」文字链接换成 32px 的 `←` 图标键（与 `/me`、收藏夹、错题本同款 `iconKey`，`-ml-2` 让笔画落在卡片文字边缘上），放在原铭牌的位置：同一个动作不需要两种控件。③注册第一步的「继续」改成输入框内联的 `→`（与验证码行同一个焊接组），**只在输入框内容是合法邮箱格式时才出现** —— 判据用 `type="email"` 自身的 `validity`，不另养正则；箭头不出现时那条发丝内线也不出现（规则画在输入框右边缘，因为按钮 disabled 时共享样式会把自己的边框变透明）。
- **depends on**: 28.1

### 28.5 注册第一步校验邮箱是否已注册

- **issue**: #164
- **status**: 🟡 doing
- **description**: 注册页填完邮箱先问一句「注册过没有」：注册过就地提示「这个邮箱已经注册过了」并引导去登录（`loginPath(next, email)`，地址一起带过去，登录页用它预填），不进入验证码步。服务端新增 `POST /auth/email/check`（回 `{registered}`）。**这是全产品唯一一个回答这个问题的接口**，与「不区分邮箱是否存在」那套刻意设计相反 —— 代价是可被用来枚举账号，缓解是与发码共用同一个按 IP 的限流器（不便宜，但不是不可能）。理由、代价与「想撤怎么撤」都写进了 PRD §5.10 与 §7.1.9。服务端测试覆盖「未知邮箱 false / UpsertEmailUser 之后 true」（需数据库，CI 跳过）。
- **depends on**: 28.1

### 28.6 注册最后一步：设密码 + 确认

- **issue**: #165
- **status**: 🟡 doing
- **description**: 验证码验证完（账号已建、已是登录态）之后加第三步：密码 + 再输一次。上一轮把登录改成只认密码之后，「没设过密码的账号」只能靠「忘记密码」绕一圈；注册结束时顺手设一个，这个绕圈就不该发生。不需要新接口：此时是登录态且 `has_password` 为 false，`PUT /me/password` 本来就允许不带旧密码设第一个。两次不一致落在确认框那一行、少于 8 位不许提交（与服务端同一条线）。步骤写在 URL 里（`?step=password`），与第二步同理：刷新与前进后退都不会掉回上一步。
- **depends on**: 28.1, 28.2

### 28.7 重设页去掉 Google，行内箭头抽成共享组件

- **issue**: #167
- **status**: 🟡 doing
- **description**: ①重设密码页不该有「Continue with Google」：这一页的前提是「我进不去」，能用 Google 进来的人不需要重设，而「换个方式登录」就是卡片底部那条链接；开发环境的模拟登录同理。`AuthCard` 因此多一个 `withGoogle`（默认 true），关掉时分隔线一起走，不留一条悬空的线。②注册与重设的第一步问了同一件事，于是抽成 `components/auth/email-arrow.tsx`（`EmailArrow`：焊接组 + 只在 `type="email"` 的 validity 为真时出现的 `→`），两处共用而不是各写一份。实测两页行为一致（空/`abc` 无箭头、合法邮箱出现、间隙 0.00px）。
- **depends on**: 28.4, 28.5

### 28.8 重设页删掉说明句，新密码输两遍

- **issue**: #169
- **status**: 🟡 doing
- **description**: ①删掉 `/reset` 标题下那句「验证码会发到这个邮箱，验证之后就能设置新密码。」（中英 `resetSubtitle` 两键）：标题「重设密码」下面就是邮箱框、下一步就是验证码框，这句是自解释的噪音。删完之后 `AuthCard` 的 `subtitle` 只剩注册最后一步在用（那句没被点名，留着）。②`/reset` 第二步改成验证码 + 新密码 + 再输一次，两次不一致就地报错、落在确认框那一行：改密码低频又易输错，没有确认框就是把用户锁在门外的做法。两次一致性在**客户端**检查而不是交给服务端 —— 重复输入是为了抓输入框前面的那个手误，往返一次抓不到（两份会是同一个手误）。
- **depends on**: 28.7

### 28.9 游客态账号卡：换文案，登录改成下划线文本

- **issue**: #171
- **status**: 🟡 doing
- **description**: 未登录时卡里是一个居中的 `lg` 填色「登录」按钮，与顶栏右上角那个一模一样 —— 同一屏两个同形主按钮，而顶栏那个永远在场，所以卡片里这个是多余的、形状也是错的。改成：**标题（`账号`）留着**，身份那一行换成一句实话 `Hmm, we don't know you yet — please log in.` / 「嗯……我们还不认识你，请登录。」，**入口就是句子里的 `log in`**（下划线链接，没有单独的按钮）。句子与链接靠 `Trans`（句子里嵌组件的正规做法，首次使用）保住语序，中英各自成句、不拼字符串。卡片高度仍由右侧热力图决定，实测与已登录态一致（0px 差）。
- **depends on**: 7.1.4

## M29 landing 的钢琴声：三个真采样

### 29.1 懒加载 3 个 Salamander 采样，替掉三角波合成器

- **issue**: #174
- **status**: 🟡 doing
- **description**: landing 上所有音符都是三个三角波合成的（基频 + 2× 的 0.22 + 3× 的 0.07，过 3400Hz 低通），注释里给的理由是「不许带上引擎那 8MB 采样」。听感确实不像钢琴（没有击弦瞬态、亮度固定、尾音太干净），而这一页唯一的职责就是让人听见产品的声音。改成按需取 **3 个**采样（同一个 Salamander 库：`C4` / `F♯4` / `C5`，合计 211KB），`playbackRate` 移调覆盖 midi 60–77（最坏 5 个半音），普通 Web Audio、不引入 Tone.js，包体积不变；第一次手势开始下载；合成器留作 CDN 失败时的兜底。单测盯住「音域内每个音离最近采样不超过 6 个半音」。
- **depends on**: 7.1.2、7.1.3

## M30 账号三件套：头像 / 用户名 / 邮箱

### 30.1 抽成一个组件两处复用；用户名可改（`PUT /me/name`）

- **issue**: #176、#177
- **status**: 🟡 doing
- **description**: 首页账号卡与账号页原来各写一套身份显示（卡片是头像 + 邮箱，账号页是头像选择器 +「账号」标签 + 名字 + 邮箱）。抽成 `AccountIdentity`（两个尺寸）并让前两件**就地可改**：点头像选文件（沿用原有校验与 `POST /me/avatar`，`avatar-picker.tsx` 并进来后删除），点用户名就地编辑。**表里没有 `username` 这一列**，是 `name TEXT`（Google 写入，验证码注册的账号为 `NULL`），于是新增 `PUT /me/name`（trim 后 1–50 字符，空拒绝，返回更新后的账号）；`name` 为空时显示可点的「添加用户名」空位。改名走**乐观更新**：先改界面、失败回滚 + 一句原因，输入框立刻收起。顺带三处清理：顶栏去掉「我的账号」键（账号页仍由首页卡片那个按钮进）、铭牌改指 app 根（`VITE_LANDING_URL` 随之从 web/compose/deploy 三处删掉）、账号页去掉改密码卡片（`PasswordForm` 一并删除，Google 账号想要密码走重设流程）。
- **depends on**: 5.10、7.1.2、7.1.4

### 30.2 `/me` 上的三处读不懂

- **issue**: #185
- **status**: 🟡 doing
- **description**: ①计划卡顶部那句 `plan.description`（「设定每日题数与重点模块……」）删掉：字段名自己已经说了，句式又是"X 和 Y；Z 按它生成"，属于自解释的说明句。②统计卡的「模块分布 / By module」原来那根条画的是**该模块占累计题数的比例**，而同一行右边的数字是**正确率** —— 一行两个量、只有一个有条，读的人自然把条当成正确率（然后就对不上）。改成条 = 正确率（同一个 `percent` 既写文字又定宽度），标题照实叫「各模块正确率 / Accuracy by module」。③「每日题数 / Questions per day」是那张 14 根柱子的图，标题没说范围、也没说柱高是什么：标题改成 `每日题数（近 {{days}} 天）`（天数取 `data.daily.length`，不写死 14）。实测：计划卡那句没了；14 根柱子**每根**都命中 `title`（`2026-09-26：9 题`）；模块条宽度与文字对上（单音 75.0% ↔ 正确率 75%、音程 50.0% ↔ 50%）；四个大数（10 / 70% / 2 / 1）不变。**再改**：这一段按用户要求从横向的条改成**柱状图**，并按用户第二轮意见定稿 —— 五个模块**全部都画**（没练过的写 `0 题`、数值 `—`）、柱子**固定 16px**、柱间留 80px（390px 下 37px）、发丝线画 0 / 50% / 100% 三条**坐标线**（刻度文字与线对齐）、柱色用 `primary`（浅色近黑、深色近白）；整张图占满卡片正文栏（上限 448px，与「每日题数」同宽同左边界，绘图区 416×200px）；横轴不写名字，**每个模块一条自身颜色的 2px 下划线**（与关卡页选项卡选中态同一种标记），名字/正确率/练了多少/对了多少放进柱子上的**悬停卡片**（`pointer-events: none`、默认 `opacity-0` 所以读屏也能读到；最外两根的卡片贴边对齐）。实测：柱宽 16px、间隙 80/80/79/80px、五条下划线各 16×2px 且颜色为五个模块色、每条下划线中心与对应柱中心对齐（5/5）、轴上无圆圈无文字、柱高与柱上数字一致、卡片不出卡。实测：五根柱高与印出的数字一致（75% ↔ 75.0%、50% ↔ 50.0%），柱心与轴标签中心 5/5 对齐，三条线与刻度文字的对齐误差 ≤1px，柱色浅色 `rgb(12,10,9)` / 深色 `rgb(250,250,249)`，居中在 1200px 下左右各 404px、390px 下各 3px（不横向溢出，柱宽两处都是 40px）。
- **depends on**: 7.1.2、5.0.1、5.2

### 30.3 「每日题数」图：加纵轴刻度与柱顶数字

- **issue**: #187
- **status**: 🟡 doing
- **description**: 这张 14 根柱子的图本身没错（每根一天、柱高 = 当天答了多少题），但**图上什么都没写**：没有纵轴刻度、没有单位，题数只在悬停的原生 `title` 里，而 14 天里通常只有两三天有柱子 —— 用户第三次问「这是啥」。改成与下面那张模块图同一套词汇：左侧纵轴标 `0 / 一半 / 峰值`（峰值取最忙的一天）、0 与 50% 两条发丝网格线 + 左竖下横两条轴、**每天有题数就把数字印在自己柱顶**（保留 10% 下限）、悬停同样换成**自己写的读数卡片**（日期 + 当天题数，与模块图那张同一套：`pointer-events: none`、默认 `opacity-0`、最外两根贴绘图区边缘，原生浏览器提示一个都不留）。顺带把这张图拆成 `practice-trend.tsx`（`practice-stats.tsx` 上一轮已到 258 行，超了 250 的门槛，拆完 187 行）。实测：刻度 `9@833 / 5@861 / 0@889` 与网格线 `833/860/889` 全部对齐（≤1px）；柱顶数字与 `title` 里的一致（`1→1`、`9→9`）、0 题的天不印数字、数字紧贴柱顶；柱上数字合计 10 与图的无障碍标签「共 10 题」一致；14/14 根有 `title`；390px 下 12px 列宽、数字互相不压、不横向溢出；柱色浅色 `rgb(12,10,9)` / 深色 `rgb(250,250,249)`。
- **depends on**: 7.1.2、5.2

### 30.4 头像：点开是预览，更换头像有自己的按钮

- **issue**: #183
- **status**: 🟡 doing
- **description**: `AccountIdentity`（首页卡片与 `/me` 同一个组件）里，点头像原来是直接弹文件选择器，而卡片底部那行放的是「移除」—— 不常走、不可逆，却占着唯一的键。改成：点头像**预览**（`AvatarPreview`，`<dialog>` + `showModal()`，`<Avatar>` 的 `xl` = 256px；点图片外面关掉，靠 ConfirmDialog 那套「`event.target` 是 dialog 本体」的判法，Esc 由平台自己关），底部那行改成**「更换头像」按钮**（复用现成的 `auth.avatarUpload`），文件选择器归它。顺带删掉因此没人用的 `isUploadedAvatar` / `UPLOADED_PREFIX` 与 `avatarRemove` 文案。实测（首页与 `/me` 各一遍）：底行只剩一个按钮、文案是「更换头像」、`min-h` 与行高都是 20px（占位那行没变）、头像底边与邮箱底边差 0.00px（行没被推动）；点头像后 `showModal` 被调用一次、`:modal=true`、`::backdrop` 显示为 `bg-ink/60`、焦点落在 dialog 上、图 256×256，且**没有**碰文件选择器（拦截 `input.click` 计数为 0）；点左上角（即背景层，命中元素就是 dialog 本体）关掉、Esc（`cancel`）关掉；点「更换头像」触发且只触发一次文件选择；英文一侧文案是 `Change avatar`、`aria-label` 是 `Preview picture`。
- **depends on**: 5.0.3、7.1.4

### 30.5 把 achievements（成就徽章）整块删掉

- **issue**: #188
- **status**: 🟡 doing
- **description**: `/me` 统计卡最底部的成就徽章（起步 / 热身完毕 / 百题 / 五百题 / 坚持一周）读者判断「没啥用」，整块下线 —— **连 API 一起**：`/me/stats` 不再返回 `achievements`，`services/practice.go` 里的 `achievementSpecs` / `StreakAchievementTarget` / `achievements()`、`models.Achievement`（含 `Achieved()`）、handler 里的映射、`openapi.yaml` 的 schema 与 `required` 项、`TestAchievements` 全部删掉，两份生成物（`schema.d.ts` / `generated.go`）重新生成。前端同时删掉那一块 UI、`stats.achievements` 与 `achievements.*`（5 个徽章 × 两种语言）文案键。数据库不受影响（成就按累计数实时算，没有表）。实测：接口顶层字段只剩 `solved / correct / accuracy / streak / byExercise / daily`；页面 `h3` 只剩「每日题数（近 14 天）」与「各模块正确率」；文案键 212 → 201。
- **depends on**: 5.10、7.1.2

## M34 每日练习：一个会话把今天练完（`/daily`）

### 34.1 一个会话 N 题、模块混排

- **issue**: #193
- **status**: 🟡 doing
- **description**: PRD §5.0.1 写的是「在重点模块之间轮转」，实现是「一次一个模块 + 手动回首页再点」。现在把「一题」从五个练习屏里拆出来：每个模块一个文件（出题工厂 + 这一题的身体 + 这一题的设置面板），一个 `<QuestionBody>` 按 `question.kind` 分发，五个练习屏变成「外壳 + 身体 + 设置 + 下一题 + 小结」（都变短了：屏本身 90 行上下，最长的一题是节奏的身体 223 行），`/daily` 因此完全不需要知道模块细节。会话：进入时算「今天还差几题」（`sessionSize`，单次上限 20，已达标 = `min(目标, 20)`），`dailyPlan(focus, count)` **分层平均**分配（20 题 3 模块 = 7/7/6）后打散顺序；页头 `h1` = 每日练习、徽标 = 当前模块名、进度 = **当天**的 `N / 目标`；设置按当前模块显示（`ModuleSettings` 按 kind 加 key 重挂，因为 hook 不能接一个会变的模块）；答完照旧 `POST /me/practice-records`，服务端不加接口，退出再进从当天记录重算。分配是纯函数，带单元测试（`lib/daily.test.ts`，只跑在 node 下所以 `daily.ts` 内部用相对导入）。顺带：`round-summary` 里那个中英文都不存在的 `daily.afterRound` 补上了（原来登录用户做完一轮，页面上显示的是字面量），达标时改说「今日已达标」；节奏屏原先自己那颗「新节奏」按钮撤掉，改走统一的「下一题」（`actions.newRhythm` 键删除）。
- **depends on**: 5.0.1、5.1、5.7、7.1.4

### 34.2 计划表单：「一个都不选」不再是个歧义

- **issue**: #193
- **status**: 🟡 doing
- **description**: `focus_exercises = []` 的语义是「不缩小范围」，但表单把空列表画成**五个都没亮**，而保存只校验题数 —— 用户能存下「一个都不选」，界面显示全灭、实际行为是五个都用。现在：语义不动（`[]` = 全部，API 与已有数据都不动），**表单进来就五个全亮**，全灭时禁用保存并说明理由（`plan.pickOne` / `plan.goalRange`）。`/me` 上「去练今天的一组」改指 `/daily`。
- **depends on**: 5.0.1、5.11

## M33 热力图：今天的形状还给日历

### 33.1 今天不再是菱形，还没到的日期用更浅的颜色

- **issue**: #191
- **status**: 🟡 doing
- **description**: 「今天」那格原来自带 `rotate-45 scale-75`（菱形），是为了避开描边又不让形状闲着，但读者判断**难看**。现在**今天与别的日子画法一致**（颜色照旧说那天达标没有），改用**更浅的颜色标「还没到」**：周 / 月档里今天之后的格子（本周剩下的几天、本月剩下的几天）用 `FUTURE_CLASS = bg-surface-strong/40`，即空日子一半浓度。于是今天由**淡色格子的起点**代替记号，图例里给菱形留的那一格改成淡色方块（`heatmap.today` → `heatmap.future`，中英各一键）。年档不受影响：它的数据序列本来就在今天结束，没有未来的日子。实测：周 / 月档里 `> today` 的格子算出 `color-mix(… 40%, transparent)` 的浅色、其余空日子仍是满浓度；今天那格 `transform: none`、类名里没有 `rotate-45`；年档 371 格无一带旋转；图例四格是「没练 / 练了一部分 / 达标 / 未来」，第 4 格的底色与未来格子逐像素相同。
- **depends on**: 7.1.4

## M32 练习页：三处「东西不该在那儿」

### 32.1 没听就能选、关卡模式还能改设置、多余的「重放」按钮

- **issue**: #190
- **status**: 🟡 doing
- **description**: `/exercise/` 一屏三处：**(1)** 选项区在题目响之前就可点 —— 先选等于猜，改成听过一遍之前锁着（灰 `opacity-50` + `disabled`，点「下一题」重新锁上）；锁着而不是播放完才出现，是因为选项在指针底下跳出来更糟。四个有选项的模块各自记一个 `heard`，`PlayButton` 加了 `onPlay`（在点击当下触发，不 `await` 采样 —— 等加载器回来再置位，采样到不了就把选项永久锁死）。节奏模块本来就要先播放才有相位可点，不用改。**(2)** 关卡模式（`?level=`）不该出现「练习设置」：面板里是用户自己的配置，实际生效的是关卡的，改它没有效果 —— 判断放在 `ConfigPanel` 里一处（五个练习屏都从这里画设置，写五遍 `if` 就是五次机会忘掉一次），用新抽的 `useLevelRequested()`（读 URL 而不是等目录，免得目录到达前先闪一下）。**(3)** 旋律模块「播放」旁边那个「重放」按钮删掉：两个按钮调同一个函数、播同一段旋律，播放按钮点第二次本来就是重放；`actions.replay` 键一并删除。实测：单音 8 / 音程 4 / 和弦 4 / 旋律 4 个选项，播放前都是 `锁/0.5`、播放后 `可/1`、点「下一题」回到 `锁/0.5`；随机练习有设置面板、五个模块的关卡模式都没有；旋律只剩一个播放按钮。
- **depends on**: 5.1、5.7、5.0.2、5.11

## M31 关卡页的模块选项卡

### 31.1 等宽 + 模块色下划线，不再用焊接块

- **issue**: #181
- **status**: 🟡 doing
- **description**: `/levels` 的五个模块原来沿用首页 Learn / Random 的焊接组（外框 + `divide-x` + 选中态 `bg-surface-strong`）。焊接组是二选一开关的形态，而这里是五个平级兄弟，且每个模块都有自己的颜色。改成：每个 tab = 模块色点（复用 `ModuleSwatch`）+ 名字，选中的那个底部一条 2px **该模块颜色**的下划线（绝对定位，免得有无下划线改变行高），五个 tab 等宽（`flex-1` + `min-w-28`，窄屏横向滚动不折行）。实测：五格各 227.4px（差 0.02px）、行高 42.5px、切换时宽度与行高都不变、全场只有一条下划线且颜色随 tab 变成该模块色、390px 下每格 112px 可滚动不折行。首页的 Learn / Random 与日历倍率不动。
- **depends on**: 7.1.5

### 31.2 关卡页：游客引导到随机练习，补上返回键

- **status**: 🟡 doing
- **description**: ①`/levels` 补一个 32px `←` 返回键（与 `/me`、收藏夹、错题本同款，回首页）—— 这三处都有，唯独关卡目录漏了。②游客横幅里加一句「不想登录？试试随机练习。」，链接指向 `/?mode=random`：关卡链要账号，而随机练习不需要，这是游客最该听见的一条出路。为了能从别处链过去，**首页的 Learn / Random 也改成 URL 参数**（`/?mode=learn|random`，缺失或非法值退回 Learn，切换用 `replace`），与关卡页的模块选项卡同一套做法。实测：游客横幅里两个链接（登录 → `/login?next=%2Flevels`、随机练习 → `/?mode=random`）、点过去落到随机那格且该 tab 选中、`replace` 不改历史条数（3→3）、非法值退回 Learn、登录后横幅与引导一起消失而返回键仍在；`Trans` 的标签用 `randomTest`（非空元素名）没漏标签。
- **depends on**: 7.1.5、5.10
