---
name: DoseCerta
description: Seu co-piloto de hábitos e tratamento com GLP-1.
colors:
  companion: "#3b4c5e"
  companion-mist: "#6c8496"
  companion-haze: "#c3d2d9"
  page: "#eef2f4"
  desk: "#e2e8ec"
  card: "#ffffff"
  sunken: "#f4f7f8"
  ink: "#12181f"
  ink-muted: "#5a6873"
  ink-faint: "#9aa6af"
  on-hero: "#ffffff"
  on-hero-muted: "rgba(255, 255, 255, 0.78)"
  on-hero-faint: "rgba(255, 255, 255, 0.42)"
  ok: "#2e7d5b"
  ok-soft: "#e6f2ec"
  warn: "#b4741f"
  warn-soft: "#fbf1e2"
  danger: "#b3372f"
  danger-soft: "#fbeae9"
  alert-hero-deep: "#5e4a3b"
  alert-hero-mist: "#967c6c"
  alert-hero-haze: "#d9cec3"
  alert-hero-alt-start: "#d97706"
  alert-hero-alt-end: "#b45309"
  nav-active: "rgba(18, 24, 31, 0.06)"
  btn-primary-bg: "#1e293b"
  btn-primary-text: "#ffffff"
  btn-primary-hero-bg: "#ffffff"
  btn-primary-hero-text: "#0f172a"
  chart-tooltip-bg: "rgba(17, 24, 39, 0.92)"
  chart-weight: "#14b8a6"
  chart-waist: "#38bdf8"
  chart-calories: "#f97316"
  chart-protein: "#eab308"
  chart-water: "#0ea5e9"
  chart-symptom: "#ef4444"
  chart-injection: "#a855f7"
  chart-axis: "#9ca3af"
  chart-grid: "rgba(156, 163, 175, 0.2)"
typography:
  display:
    fontFamily: "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(52px, 16vw, 68px)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "clamp(30px, 9vw, 38px)"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.04em"
rounded:
  field: "14px"
  glass: "20px"
  card: "24px"
  pill: "999px"
  focus-ring: "4px"
spacing:
  gutter: "20px"
  touch-min: "44px"
  tab-bar-height: "56px"
components:
  button-primary:
    backgroundColor: "{colors.btn-primary-bg}"
    textColor: "{colors.btn-primary-text}"
    typography: "{typography.body}"
    rounded: "rounded-xl (12px)"
    padding: "12px 24px"
  button-primary-hero:
    backgroundColor: "{colors.btn-primary-hero-bg}"
    textColor: "{colors.btn-primary-hero-text}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "10px 24px"
  field:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    height: "44px"
  sheet-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  glass-card:
    backgroundColor: "{colors.on-hero-faint}"
    textColor: "{colors.on-hero}"
    rounded: "{rounded.glass}"
  nav-item-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
---

# Design System: DoseCerta

## Overview

**Creative North Star: "The Steady Companion"**

DoseCerta is monochrome first and color-as-meaning second: ink on soft gray, a single dusty slate-blue hero gradient, and hairline dividers, with saturated color spent almost nowhere except the three semantic states (ok / warn / danger). The restraint is not decoration — it exists so the AI co-pilot and the person's own numbers (weight, doses, symptoms) stay legible and calm to read, day after day, without visual noise competing for attention. Glass surfaces, soft dual-layer shadows, and generous corner radii keep the discipline from reading cold; nothing here is trying to look clinical or trying to look fun. It sits deliberately between those two failure modes: it never reaches for gamified confetti, badges, or mascots, and it never reaches for dense hospital-software tables or harsh saturated blues. Numbers are the largest thing on the screen (`t-display`, `t-stat`), rendered in thin weights so scale reads as clarity, not shouting.

Where the palette does speak — `ok`, `warn`, `danger` — it speaks more plainly than the hushed neutral system around it: these are the one place the interface is allowed to raise its voice, because they carry information a person on a GLP-1 titration schedule genuinely needs to notice (a missed dose, a symptom flare, stock running low).

**Key Characteristics:**
- Monochromatic ink-on-gray base; color reserved for semantic meaning, not decoration.
- One dusty slate-blue hero gradient anchors the brand; everything else is neutral.
- Soft, diffuse shadows only — never hard-edged or directional.
- Large corner radii (14–24px, pill for actions) read as gentle, not sharp or corporate.
- Typography scale carries hierarchy through size and weight, not color.
- Every screen respects iOS safe areas; the bottom tab bar is the only persistent chrome.

## Colors

Low-saturation neutrals and a single hero gradient dominate; the semantic trio is the system's only permitted vividness.

### Primary
- **Companion Slate** (`#3b4c5e`): the hero gradient's anchor tone (`--hero-0`). Used for the top-of-screen hero background and splash screens. Reads as calm and dependable, never corporate-blue.
- **Companion Mist** (`#6c8496`) / **Companion Haze** (`#c3d2d9`): mid and light stops of the same hero gradient (`--hero-1`, `--hero-2`), used only within `--grad-hero` and `--grad-splash` — never as standalone flat fills.
- **Alert Hero Deep** (`#5e4a3b`) / **Alert Hero Mist** (`#967c6c`) / **Alert Hero Haze** (`#d9cec3`): a warm, earthy shift of the same gradient shape (`--grad-hero-alerta`), swapped in for the hero background specifically when an application is overdue. Same three-stop structure as the calm gradient, just recolored — the shape of the identity stays recognizable even in a warning state. On the `menta-claro`/`lavanda-clara` themes this becomes a two-stop **Alert Hero Alt** (`#d97706` → `#b45309`, amber): those themes' base palettes sit too close in hue to the earthy default warning shift to read as distinct, so they get a more saturated amber instead.

### Neutral
- **Page** (`#eef2f4`): the base app background (`--surface-page`) and the hero gradient's lightest stop.
- **Desk** (`#e2e8ec`): the tablet/desktop chrome background around the app shell (`--surface-desk`).
- **Card** (`#ffffff`): all elevated surfaces — sheet cards, the bottom tab bar, dialogs.
- **Sunken** (`#f4f7f8`): recessed surfaces inside a card — input fields, well-like containers (`--surface-sunken`).
- **Ink** (`#12181f`): primary text on card surfaces.
- **Ink Muted** (`#5a6873`): secondary text on card surfaces — AA-adjusted (see Named Rule below).
- **Ink Faint** (`#9aa6af`): ornament only — gridlines, axis labels, dividers. Never body text.
- **On Hero** (`#ffffff`) / **On Hero Muted** (`rgba(255,255,255,.78)`) / **On Hero Faint** (`rgba(255,255,255,.42)`): the same primary/secondary/ornament roles, restated for text sitting on the dark hero gradient instead of a card.
- **Nav Active** (`rgba(18,24,31,.06)`, `--nav-ativo`): a subtle ink-tinted wash marking the active tab/nav item, on top of which the label switches to full `--ink`. Not a fill color — a wash meant to be barely-there, felt more than seen.

### Semantic
- **Ok** (`#2e7d5b`) on **Ok Soft** (`#e6f2ec`): confirmations, on-track states.
- **Warn** (`#b4741f`) on **Warn Soft** (`#fbf1e2`): attention-needed states (e.g. low pen stock, approaching titration step).
- **Danger** (`#b3372f`) on **Danger Soft** (`#fbeae9`): missed doses, errors, destructive actions.

### Data Visualization
Charts are the one deliberate exception to the semantic-only color rule: distinguishing several simultaneous series (weight vs. waist, calories vs. protein, water intake vs. a symptom spike) genuinely needs more hues than `ok`/`warn`/`danger` can offer, so a dedicated data-viz palette exists outside the UI-chrome system. It is used **only** inside chart components (`src/components/GraficoEvolucao*`) — never for buttons, badges, or any UI chrome.
- **Chart Weight** (`#14b8a6`, teal) — weight line. **Chart Waist** (`#38bdf8`, sky blue) — waist-measurement line.
- **Chart Calories** (`#f97316`, orange) — calorie bars. **Chart Protein** (`#eab308`, amber) — protein line.
- **Chart Water** (`#0ea5e9`, blue) — hydration bars. **Chart Symptom** (`#ef4444`, red) — symptom-day marker/badge.
- **Chart Injection** (`#a855f7`, purple) — the injection-day marker shared across weight/waist/hydration charts, so a dose always reads as the same color regardless of which metric it's overlaid on.
- **Chart Axis** (`#9ca3af`) / **Chart Grid** (`rgba(156,163,175,.2)`): axis labels and gridlines, low-contrast by design so the data reads first.
- **Chart Tooltip** (`rgba(17,24,39,.92)`, near-black): every chart tooltip renders on this fixed dark chrome regardless of the active theme — the one surface in the app that doesn't follow the theme token layer, because Recharts renders tooltips into their own layer where per-datapoint theme lookups aren't worth the complexity for what is, today, mostly a light-mode-default app.

### Named Rules
**The Quiet-Until-It-Matters Rule.** Saturated color is spent only on `ok` / `warn` / `danger` in UI chrome, and on the dedicated data-viz palette inside charts. Every other surface, including the primary action color, stays inside the ink/gray/slate-blue family. If a new element wants a bright color "to stand out," the answer is size, weight, or position — not saturation.

**The AA-Over-Aesthetic Rule.** `--ink-muted` and `--on-hero-muted` were deliberately darkened past what the original visual reference used, specifically to clear WCAG AA contrast. The pre-AA, barely-visible gray survives only as `--ink-faint`, and it is restricted to ornament (gridlines, axes, dividers) — never to text carrying meaning.

**The Tokens-Not-Branches Rule.** Every color that varies by theme (default, `oceano-escuro`, `menta-claro`, `lavanda-clara`) is a CSS custom property in `tokens.css` — never an `if (theme === ...)` branch inside a component returning a literal class or hex. A component reads `var(--btn-primary-bg)`, `var(--nav-ativo)`, etc.; it never asks what the active theme is. This was a real regression once (the nav and primary button used to branch on theme in JS, and the login screen hardcoded the default theme's gradient, so switching themes didn't switch the login screen) — fixed by moving every themed value into `tokens.css`.

### Themes
The token layer supports four selectable themes, all defined in `tokens.css` and switched via a `data-theme` attribute on `<html>` (`ThemeProvider.tsx`): the **default** theme (the palette described above), **`oceano-escuro`** (an explicit dark theme — same structure, inverted surfaces), **`menta-claro`** (teal hero `#14b8a6`→`#0f766e`, light backgrounds), and **`lavanda-clara`** (purple hero `#a855f7`→`#7e22ce`, light backgrounds). The default theme also auto-switches to the same dark palette as `oceano-escuro` under `prefers-color-scheme: dark` when no theme is explicitly chosen. Every themed surface, text, and accent color is re-declared per theme as the same custom-property names — a component never needs to know which theme is active.

## Typography

**Body & Display Font:** Inter Variable (with `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` fallback), loaded locally via `@fontsource-variable/inter` — no external font request.

**Character:** One typeface, used entirely through size, weight, and spacing rather than a display/body pairing — hierarchy comes from a disciplined type scale, not from mixing families.

### Hierarchy
- **Display** (weight 300, `clamp(52px, 16vw, 68px)`, line-height 1, tracking `-0.02em`, tabular numerals; **76px at ≥64rem**): the single largest number on a screen — e.g. current weight, days until next dose. The `vw`-based clamp hits its own 68px ceiling by ~425px of viewport width, so a `@media (min-width: 64rem)` step bumps it further on desktop — `vw` tracks the viewport, not the (much narrower) content column, so the clamp alone can't give desktop the extra headroom.
- **Stat** (weight 400, `clamp(30px, 9vw, 38px)`, line-height 1.1; **42px at ≥64rem**): secondary large figures inside cards (gauges, summaries). Same desktop-headroom step as Display.
- **Title** (weight 500, 17px, tracking `-0.01em`): section and screen titles.
- **Body** (weight 400, 15px, line-height 1.45; **16px on `<input>`/`<select>`/`<textarea>`**): default reading text. Form fields specifically bump to 16px to defeat iOS Safari's auto-zoom-on-focus — the one place Body has two committed values, both documented, neither a drift.
- **Label** (weight 500, 13px): form labels, tab bar text, secondary UI text.
- **Caption** (weight 500, 11px, tracking `0.04em`, uppercase): the smallest tier — eyebrow text, timestamps, metadata.

### Named Rules
**The Weight-Not-Color Rule.** Hierarchy is built from size and weight (display is the lightest weight at the largest size; caption the heaviest-relative weight at the smallest size), never from introducing a second color for "important" text. Ink stays ink.

## Layout

Mobile-first single column that becomes a fixed-width desktop panel with a left rail past the `lg` (64rem) breakpoint — there is no fluid full-bleed desktop mode; the app shell (`.casca-app`) caps at 28rem below 48rem, 40rem between 48rem and 64rem, then unlocks to a `15rem` nav rail + centered content at 64rem+.

Content sits inside a centered track (`.faixa`): `max-width: 100%` up to 64rem, then `70rem`, with `padding-inline` of `20px` (the `--gutter` token) that widens to `2rem` at the desktop breakpoint.

Breakpoints in active use are `sm` (40rem — tablet card framing) and `lg` (64rem — desktop nav/grid); the system deliberately skips a heavy `md` tier.

Safe-area handling is load-bearing, not optional: `viewport-fit=cover` is set at the document level, and `env(safe-area-inset-bottom, 0px)` / `env(safe-area-inset-top, 0px)` are applied wherever content could sit under the iOS home indicator or notch — the bottom tab bar, sheet modals, toasts, and the hero header all account for it individually.

## Elevation & Depth

Elevation is ambient by default — depth reads mainly through surface-color contrast (page vs. card vs. sunken), not shadow stacking — but sheet-style overlays are the deliberate exception, where a shadow plus a `bg-black/45` backdrop is used to make the overlay read as structurally above the page, not just visually decorated.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(18,24,31,.04), 0 8px 24px rgba(18,24,31,.06)`): the default lift for `SheetCard` and similar elevated containers — soft and dual-layered, never a single hard shadow.
- **Glass** (`box-shadow: 0 8px 32px rgba(18,24,31,.12)`): heavier, paired with `backdrop-filter: blur(20px)` on translucent surfaces (glass tooltips, glass buttons on the hero).

### Named Rules
**The Ambient-Except-Overlays Rule.** Shadows stay soft and atmospheric on in-flow surfaces (cards, buttons). The one place elevation is allowed to mean "above everything else" is a modal/sheet overlay, paired with a dark backdrop — that combination is reserved for true overlays, not used to fake importance on regular content.

## Shapes

Corners are systematic, not ad hoc: four radius tokens cover every surface in the app. `--r-field` (14px) for inputs and inline alerts, `--r-glass` (20px) for translucent glass surfaces, `--r-card` (24px) for cards and the injection-logging sheet, and `--r-pill` (999px, delivered mostly via Tailwind's `rounded-full`) for buttons, tab-bar icons, and circular touch targets. Nothing in the system uses a sharp (0px) corner. Hairlines (`--hairline: 1.5px`) at low-opacity ink (`--border-hair: rgba(18,24,31,.08)`) are the only border treatment — never a heavy or saturated border.

A fifth, smaller radius exists for one purpose only: the global `:focus-visible` outline (`border-radius: 4px`) on every focusable element (`a`, `button`, `input`, `select`, `textarea`, `[tabindex]`). It rounds the corner of the outline ring itself, not a surface — small on purpose, since a big radius on a thin outline ring reads as sloppy rather than soft.

### Named Rules
**The No-Sharp-Corners Rule.** Every surface — from a 14px field to a full pill button — carries a soft corner. A new component introducing a 0px or small (4–8px) radius for a *surface* breaks the family; round it into one of the four surface tokens instead of adding another. The one sanctioned exception is the 4px focus-ring radius, and it's scoped to the focus-outline ring itself, never a surface.

## Components

Buttons, cards, and fields all aim for the same tactile target: **gentle and reassuring**. Transitions are soft, movement is minimal, and affordance comes from clear color/shape logic rather than snap or bounce.

### Buttons
- **Shape:** `rounded-xl` (12px) for primary actions on card surfaces; `rounded-full` (999px) for primary actions on the hero and for all secondary/ghost buttons.
- **Primary:** `var(--btn-primary-bg)`/`var(--btn-primary-text)` (default: `#1e293b` on white), `shadow-md`, `hover:shadow-lg hover:-translate-y-0.5`, `font-semibold`, `px-6 py-3`. On the hero, primary flips to `var(--btn-primary-hero-bg)`/`var(--btn-primary-hero-text)` instead (default: a white pill with near-black text, `shadow-lg hover:shadow-xl`). Both pairs are theme tokens — no component branches on the active theme (see The Tokens-Not-Branches Rule).
- **Secondary:** `min-h-11`, `rounded-full`, `px-6`; glass treatment (`--surface-glass` + `blur(12px)` + `--border-glass`) on the hero, transparent with a hairline border on cards.
- **Ghost:** transparent background, muted text color, `hover:opacity-85` only — no shadow, no lift.
- **Disabled (all variants):** `opacity-45 pointer-events-none`.

### Cards / Containers
- **Corner Style:** `--r-card` (24px), or top-corners-only when a card sits flush against the hero (`variante="topo"`).
- **Background:** `--surface-card` (white).
- **Shadow Strategy:** `--shadow-card`; omitted entirely for the top-flush variant (see Elevation & Depth).
- **Internal Padding:** `p-5` (20px), `lg:p-6` (24px) on desktop.

### Glass Surfaces
- **Style:** `--surface-glass` background, `--r-glass` (20px) corners, `backdrop-filter: blur(20px)`, `--shadow-glass`.
- **Use:** tooltip-like overlays and secondary buttons/panels sitting directly on the hero gradient, where a solid card would fight the gradient instead of floating on it.

### Inputs / Fields
- **Style:** `min-h-11` (44px, meeting the `--touch-min` target), `--r-field` (14px) corners, `--surface-sunken` background on cards / `--surface-glass` on the hero, hairline border.
- **Label:** `t-caption` sits above the field.
- **Error:** border shifts to `--danger`.
- **iOS zoom guard:** any `t-body`-classed `input`/`select`/`textarea` is forced to 16px so focusing a field never triggers Safari's auto-zoom.

### Alerts / Badges
- **Style:** `p-4`, `--r-field` (14px) corners, tri-tone background/text pairing from `ok`/`warn`/`danger` + their `-soft` backgrounds.
- **Accessibility:** icon, color, and text are always paired together — color is never the sole carrier of meaning.

### Navigation (Bottom Tab Bar + Desktop Rail)
- **Style:** fixed to the viewport bottom on mobile (`lg:hidden` — replaced by a `15rem` left rail on desktop, `NavLateral`), `--surface-card` background, hairline border, `padding-bottom: env(safe-area-inset-bottom, 0px)` on mobile.
- **Touch targets:** `min-h-14` per tab on mobile, `min-h-11` per item on desktop.
- **Active state:** `background: var(--nav-ativo)` (the ink-tinted wash), `color: var(--ink)`; inactive items sit at `color: var(--ink-muted)`. Same two tokens drive both the mobile tab bar and the desktop rail, and the same pair carries every theme automatically — always paired with the icon/label, never color-only.

### Logging Sheet (signature component)
The injection-logging sheet (`FolhaRegistro`) is the app's signature interaction surface — a bottom sheet on mobile (top corners only, `--r-card`) that becomes a centered dialog with all four corners rounded at the `sm` breakpoint, `max-h-[92dvh]`/`sm:max-h-[85dvh]` with internal scroll, over a `bg-black/45` backdrop. Injection-site rodízio (rotation) is chosen via pill buttons that invert to ink background / card-colored text when active.

## Do's and Don'ts

### Do:
- **Do** keep saturated color confined to `ok` / `warn` / `danger` in UI chrome (the data-viz palette is the one sanctioned exception, and only inside charts) — every other surface stays in the ink/gray/slate-blue family (The Quiet-Until-It-Matters Rule).
- **Do** use `--ink-muted` / `--on-hero-muted` for secondary text, not the fainter, pre-AA reference gray (The AA-Over-Aesthetic Rule).
- **Do** round every new surface into one of the four existing radius tokens (14 / 20 / 24 / 999px) rather than introducing a new radius value.
- **Do** account for `env(safe-area-inset-*)` on any element that can touch the top or bottom edge of the viewport.
- **Do** pair color with an icon or text label on any state indicator — never rely on color alone.
- **Do** keep transitions and hover states soft (opacity, small translate, shadow shift) — nothing snappy or bouncy.
- **Do** put any color that varies by theme into a `tokens.css` custom property and read it with `var(...)` — never branch on the active theme inside a component (The Tokens-Not-Branches Rule).
- **Do** meet the 44px `--touch-min` on every interactive element, including small icon-only buttons in dense lists (delete/close affordances) — not just primary actions.

### Don't:
- **Don't** introduce a second saturated brand color competing with the companion slate-blue — the hero gradient is the only "brand color" moment.
- **Don't** use hard, single-layer, or directional drop shadows — every shadow in this system is soft and dual-layered.
- **Don't** reach for gamified consumer-health patterns (badges, mascots, confetti, streak-shaming) or cold clinical-software patterns (dense tables, harsh saturated blues, no warmth) — the product sits deliberately between both.
- **Don't** let body text drop below 16px inside form fields — it triggers iOS Safari's zoom-on-focus and breaks the layout.
- **Don't** rely on the browser back button for navigation flow; this is a standalone PWA and every screen needs its own explicit way back.
- **Don't** hardcode a specific theme's hex/gradient in a screen (e.g. the default hero gradient) — it silently breaks for anyone on `menta-claro`, `lavanda-clara`, or `oceano-escuro`. Always read the token.
- **Don't** use `md:` — the system's breakpoint pair is `sm` (40rem) and `lg` (64rem) only.
