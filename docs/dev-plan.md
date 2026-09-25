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
- **status**: 🟡 doing
- **description**: `?next=` 成为唯一的回跳机制：登录页读 `next`，`RequireAuth` 与首页各登录入口跳 `/login?next=…`。`RequireAuth` 现在只传 `location.pathname`，查询串丢失，所以 `/exercise/interval?level=xx` 登录回来会掉关卡参数。`next` 必须做同源校验（以 `/` 开头、不以 `//` 开头），否则是开放重定向。Google 流程把 `next` 带过 OAuth 回路（`/api/v1/auth/google?next=…` 存进 state cookie），回调重定向到它而不是固定的 `FrontendURL + "/#access_token=…"`；顺带不再把 access token 塞进 URL hash —— 回调已经设了 refresh cookie，客户端 `restoreSession()` 本来就会用它换 token，带着反而与 PRD 7.1.2「不在 URL 里传任何令牌」冲突。
- **depends on**: 7.1

### 21.2 首页三段结构

- **issue**: #107
- **status**: 🟡 doing
- **description**: 首页改成 dashboard（PRD 7.1.4）：第一段左右布局 —— 左侧邮箱与显眼的「开始每日训练」（游客同一位置放登录引导，布局不跳），右侧今日进度与热力图；第二、三段是两个 2×3 网格。`daily.tsx` 的 `startSession()` 逻辑（还算差几题、从练得最少的重点模块开一轮、一轮最多 20 题）搬到首页。顶栏给游客一个**带字不带图标**的登录按钮，放在图标组外侧、与其他控件同为 32px 高。
- **depends on**: 21.1

### 21.3 两个网格：Learn 与 Random

- **issue**: #107
- **status**: 🟡 doing
- **description**: Learn 是 2×3 的闯关网格，前五格是五个模块的关链、第六格是收藏夹，每格带闯关进度条（已通关数 / 总关卡数）与当前关、最好成绩。Random 是同样式但**不带进度条**的 2×3 网格，第六格是错题重练。未登录时进度条显示 0、不显示假数据，点击才提示登录并回跳。
- **depends on**: 21.2, 14.4, 14.5

### 21.4 热力图四档倍率

- **issue**: #107
- **status**: 🟡 doing
- **description**: 热力图加日 / 周 / 月 / 年四个 tab，都是同一张日历的四种倍率，数据只有 `GET /me/daily` 一个来源，不新增接口：日档是当天目标的进度条（`已答 / 目标`，答满即满），周档是本周七天，月档是本月日历（30/31 个格子，随年份），年档是一年的热力图。**格子永远是一天，永远按那天自己的目标分档**，没有相对强度。星期缩写用英文。四个函数（`dayPercent` / `week` / `month` / `year`）在 `lib/heatmap.ts`，带表驱动单测。**日档是进度条**（复用闯关格子的那一套，8px 高；百分比逻辑在 `lib/heatmap.ts` 的 `dayPercent`，带单测）；**周 / 月共用 16px 格子**（2px 间距），周档铺满整行、格子均分；**年是第二个倍率**、格子随卡片宽度流式（`minmax(8px, 1fr)`，桌面 8px、宽卡最多 10px）；四个视图左边缘对齐（去掉年的 32px 星期名竖栏与缩进，年份视图因此不再横向溢出）。绘制在 `components/heatmap-views.tsx`，容器（数据 / tab / 图例）在 `components/practice-heatmap.tsx`。
- **depends on**: 15.2

### 21.5 删掉每日练习页

- **issue**: #107
- **status**: 🟡 doing
- **description**: 今日进度、开始按钮、热力图都已在首页，计划设置在 `/me`，`/daily` 没有存在意义了：删掉页面、路由与 `/daily` 的入口；`study-plan-form` 里指向它的链接改到首页；相关文案 key 迁进首页命名空间，中英同步。
- **depends on**: 21.2

## M22 落地页第二屏

### 22.1 免费与开源，footer 归位

- **issue**: #110
- **status**: 🟡 doing
- **description**: 落地页 hero 之下加第二屏（PRD 7.1.5）：三句主张「开源 / 免费 / 没有额外费用」，用压条的词汇做成三个同高的格 —— 一整圈外框 + `divide-x`，不是三张卡片；不加第二个动作按钮，不用模块色。footer 落到整页末尾：内容不足一屏贴视口底，超过一屏跟在内容之后，品牌与许可证信息不在两处重复。中英文案同步。
- **depends on**: 17.1
