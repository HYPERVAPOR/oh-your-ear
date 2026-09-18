---
version: alpha
name: oh-your-ear-design
based-on: "ElevenLabs DESIGN.md (VoltAgent/awesome-design-md) — quiet editorial system, pastel atmospheric orbs"
description: >
  A musician's practice workbook, not a dashboard. Off-white paper holds warm near-black ink;
  hairlines and one soft shadow tier separate surfaces; display type is a light editorial serif
  while the interface runs Inter. The single saturated idea in the product is the five pastel
  gradient orbs, and they are not decoration: each of the five exercise modules owns one, so the
  palette itself is the module map. Everything else is ink on paper, and the only action colour
  is the ink pill.

colors:
  # light
  canvas: "#f5f5f5"
  canvas-soft: "#fafafa"
  surface: "#ffffff"
  surface-strong: "#f0efed"
  ink: "#0c0a09"
  body: "#4e4e4e"
  muted: "#777169"
  muted-soft: "#a8a29e"
  hairline: "#e7e5e4"
  hairline-strong: "#d6d3d1"
  on-primary: "#ffffff"
  # dark
  canvas-dark: "#0c0a09"
  surface-dark: "#1c1917"
  surface-strong-dark: "#292524"
  ink-dark: "#fafaf9"
  body-dark: "#d6d3d1"
  muted-dark: "#a8a29e"
  hairline-dark: "#292524"
  hairline-strong-dark: "#44403c"
  on-primary-dark: "#0c0a09"
  # module orbs — the only chromatic colour in the product
  orb-mint: "#a7e5d3" # single note
  orb-peach: "#f4c5a8" # interval
  orb-lavender: "#c8b8e0" # chord
  orb-sky: "#a8c8e8" # melody
  orb-rose: "#e8b8c4" # rhythm
  # semantic (marks use the hue, text uses the darker variant for AA on paper)
  success: "#16a34a"
  success-text: "#166534"
  error: "#dc2626"
  error-text: "#991b1b"
  success-text-dark: "#4ade80"
  error-text-dark: "#f87171"

typography:
  display-xl: { family: display, size: 48px, weight: 300, line-height: 1.08, tracking: -0.96px }
  display-lg: { family: display, size: 36px, weight: 300, line-height: 1.17, tracking: -0.36px }
  display-md: { family: display, size: 32px, weight: 300, line-height: 1.13, tracking: -0.32px }
  display-sm: { family: display, size: 24px, weight: 300, line-height: 1.2, tracking: 0 }
  title-md: { family: ui, size: 20px, weight: 500, line-height: 1.35 }
  title-sm: { family: ui, size: 18px, weight: 500, line-height: 1.44, tracking: 0.18px }
  body: { family: ui, size: 16px, weight: 400, line-height: 1.5, tracking: 0.16px }
  body-sm: { family: ui, size: 15px, weight: 400, line-height: 1.47, tracking: 0.15px }
  caption: { family: ui, size: 14px, weight: 400, line-height: 1.5 }
  badge: { family: ui, size: 12px, weight: 600, line-height: 1.4, tracking: 0.96px, transform: uppercase }
  button: { family: ui, size: 15px, weight: 500, line-height: 1 }
  numeral: { family: ui, weight: 500, feature: "tabular-nums" }

fonts:
  display: "'Newsreader', 'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif"
  ui: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"

rounded: { xs: 4px, sm: 6px, md: 8px, lg: 12px, xl: 16px, xxl: 24px, pill: 9999px }

layout:
  nav-height: 64px
  content-max: 1200px
  rhythm: 96px # between page bands, 48px on mobile
  card-gap: 20px
  shadow: "0 4px 16px rgba(0, 0, 0, 0.04)" # hover only, one tier
---

# Oh Your Ear — design system

Adapted from the [ElevenLabs DESIGN.md](https://github.com/VoltAgent/awesome-design-md) analysis.
The source language is quiet and editorial; that is a good fit for something people use for ten
minutes a day while listening, where a loud interface would compete with the thing being learned.

## What was changed, and why

| Source | Here | Reason |
| --- | --- | --- |
| Waldenburg Light (licensed) | **Newsreader** 300 (OFL, self-hosted) | Source suggests EB Garamond 300, but that family has no 300 weight; Newsreader has a real 200–800 axis and keeps the light editorial voice. |
| Inter (body) | Inter, self-hosted variable | Same family, no third-party runtime request, works offline. |
| CJK | falls back to the OS | A Chinese webfont is megabytes; Songti/PingFang/YaHei are already on every device. |
| Five orbs as brand atmosphere | Five orbs as **module identity** | The product has exactly five modules. Colour now carries information instead of mood. |
| `semantic-success #16a34a` on paper | marks keep the hue, **text uses `#166534`** | The source green is 3.1:1 on paper — fine for a check mark, not for the word next to it. |

## Colours

- **Ink pill is the only action colour.** `primary` is near-black on paper and near-white on the dark
  canvas; nothing else in the product is allowed to be a saturated button.
- **Orbs never fill anything.** They appear as radial-gradient blooms behind a module's header, on a
  module card, and as the module's marker in lists. Never as a button fill, never as text.
- **Surface ladder:** canvas (page) → surface (card, white) → surface-strong (badges, plates), divided
  by 1px hairlines. Dark canvas → surface-dark → surface-strong-dark.
- **One shadow tier**, hover only. Depth belongs to the orbs, not to stacked shadows.

## Typography

- Display is **always weight 300**, never bold. Negative tracking scales with size (-0.32px to -0.96px).
  Bolding display copy is the fastest way to make this look like consumer marketing instead of a workbook.
- Interface text is Inter at 400/500 with +0.15–0.18px tracking — slightly loose, editorial.
- Numbers that sit in columns (stats, scores, counts) use tabular figures so they do not dance.
- `badge` (12px/600, +0.96px, uppercase) is for **tags only** — module tags, status pills. Uppercase is
  not used as a decorative eyebrow above headings.
- Avoid joining metadata with `·`; use separate lines or a hairline-separated row instead.

## Layout

- 64px nav, content capped at 1200px, bands separated by 96px (48px on mobile).
- Editorial rhythm: a page is a stack of bands; cards inside a band sit 20px apart.
- Exercise screens are the exception and are **centred**, because the object of attention is a single
  centred control — the listen button — with options below it.
- Max line length ~72 characters.

## Shapes

Pill for every CTA and badge, 16px for cards, 8px for inputs, 24px for orb-backed panels.
Sharp corners are not part of this system.

## Components

- **top-nav**: canvas background, wordmark in display type, quiet pill controls on the right.
- **button-primary**: ink pill, 40px tall, 15px/500 label. **button-outline**: transparent pill with a
  1px hairline-strong border. **button-ghost**: text only.
- **module-card**: surface card, 16px radius, hairline border, orb bloom behind the label, module name in
  display-sm, one line of description in body-sm.
- **listen-button**: the hero of every exercise screen — the largest ink pill on the page.
- **option-tile**: hairline-tinted surface tile, 16px radius, pill-shaped once correct/incorrect.
- **feedback-note**: a tinted pill in the margin note voice, sentence case, no exclamation marks.
- **config-panel**: hairline-separated rows inside a surface card; label left, control right.
- **stat-figure**: display-md numeral with a caption-uppercase label underneath.
- **empty-state**: one sentence saying what to do next, never an apology.

## Do / Don't

**Do** reserve ink for the primary action; keep display at 300; use hairlines before shadows; give every
module its orb everywhere it appears; keep copy in sentence case and active voice.

**Don't** introduce a second action colour; bold display copy; use orbs as fills; use uppercase as page
decoration; stack shadows; use sharp corners on CTAs.

## Responsive

| Width | Behaviour |
| --- | --- |
| < 640px | display-xl → 32px, module cards 1-up, rhythm 48px, nav collapses to wordmark + account only |
| 640–1024px | display-xl → 40px, module cards 2-up |
| > 1024px | full scale, module cards 3-up, content capped at 1200px |

Touch targets stay ≥ 40px; the listen button is 52px tall on every breakpoint.
