---
name: FlightMode
description: Offline-first flight companion — games, relax audio, and destination content for a cramped seat with no wifi.
colors:
  tint-light: "#2f95dc"
  tint-dark: "#7cc7ff"
  tint-crazy: "#ff3cac"
  text-light: "#11181c"
  text-dark: "#f3f7fa"
  text-crazy: "#ffffff"
  background-light: "#ffffff"
  background-dark: "#091017"
  background-crazy: "#1a0033"
  card-light: "#f3f7fb"
  card-dark: "#101b25"
  card-crazy: "#2d0057"
  surface-light: "#eef4f8"
  surface-dark: "#16232e"
  surface-crazy: "#3a006e"
  elevated-light: "#ffffff"
  elevated-dark: "#1a2833"
  elevated-crazy: "#420080"
  border-light: "#d9e3ea"
  border-dark: "#263746"
  border-crazy: "#7b2fff"
  mutedText-light: "#5f6b76"
  mutedText-dark: "#98a8b6"
  mutedText-crazy: "#c9a0ff"
  danger-light: "#d32f2f"
  danger-dark: "#ef5350"
  danger-crazy: "#ff5d8f"
  warning-light: "#f5a623"
  warning-dark: "#ffcc66"
  warning-crazy: "#ffe135"
  successBorder-light: "#58a96b"
  successBorder-dark: "#4da96b"
  successBorder-crazy: "#39ff7f"
typography:
  statValueLarge:
    fontSize: "40px"
    fontWeight: 900
    letterSpacing: "-1px"
  cardTitle:
    fontSize: "18px"
    fontWeight: 600
  cardDesc:
    fontSize: "14px"
    fontWeight: 400
  buttonPrimary:
    fontSize: "20px"
    fontWeight: 900
    letterSpacing: "1px"
  statLabel:
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "1px"
rounded:
  sm: "6px"
  md: "10px"
  card: "12px"
  button: "14px"
  panel: "16px"
  modal: "20px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "28px"
  4xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.tint-light}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.elevated-light}"
    rounded: "{rounded.modal}"
    padding: "28px"
---

# Design System: FlightMode

## Overview

**Creative North Star: "The Tray-Table Companion"**

FlightMode is built for a single scene: a cramped economy seat, airplane mode on, one hand free, sometimes at night with the cabin lights dimmed. The visual system is a plain, quiet native-UI shell (React Native `StyleSheet`, no design framework, no NativeWind) wrapped around a small, disciplined token layer — `constants/Colors.ts`, `constants/Spacing.ts`, `constants/Typography.ts` — plus a set of shared game-result/pause/countdown components that give every one of the 33 games the same feel regardless of who wrote it. It is not decorative; it is a utility skin that gets out of the way during a game and clarifies at the edges (result screens, pause modals, stat rows).

The system runs in four resolved theme modes rather than one: `light`, `dark`, and a fourth, deliberately maximalist `crazy` mode (violet/magenta on near-black) that exists as an explicit opt-in personality toggle, not an accessibility or brand variant. All three palettes share the exact same token *shape* (`text`, `background`, `tint`, `card`, `surface`, `elevated`, `border`, `mutedText`, `danger`, `warning`, `successBorder`, etc.) — only the values change — which is what lets one component tree render identically across all three without conditional logic.

**Key Characteristics:**
- One token shape, three palettes (`light` / `dark` / `crazy`) — components never hardcode a specific mode.
- Flat-first native styling: no shadows on most surfaces; the two-entry `Shadow` scale is reserved for modals/results only.
- A small shared "game chrome" layer (`GameResult`, `GameControls`, `GamePauseOverlay`, `GameCountdown`, `GameRules`) is the only thing enforcing visual consistency across 33 independently authored game modules — and it is inconsistently obeyed (see Do's and Don'ts).
- Heavy, condensed numerals (`FontWeight.black`, tight negative letter-spacing) for scores and stats; everything else stays at regular/semibold weight.

## Colors

Each palette (`light`, `dark`, `crazy`) fills the same 21-key token shape defined in `constants/Colors.ts`; components read `Colors[colorScheme].<token>` and never a literal hex.

### Primary
- **Sky Tint** (`tint`) — light `#2f95dc`, dark `#7cc7ff`, crazy `#ff3cac`: the one accent color. Drives active tab icons, primary buttons, score numbers, focus rings, progress fill, "New Best" badges. `onTint` (`#ffffff` light/crazy, `#06121e` dark) is the text/icon color guaranteed to sit on top of `tint`.

### Neutral
- **Text** (`text`): primary reading color — `#11181c` light, `#f3f7fa` dark, `#ffffff` crazy.
- **Muted Text** (`mutedText`): secondary/help copy, stat labels, disabled affordances — `#5f6b76` / `#98a8b6` / `#c9a0ff`.
- **Background** (`background`): screen canvas — `#ffffff` / `#091017` / `#1a0033`.
- **Card** (`card`): the base raised surface for list rows and secondary buttons — `#f3f7fb` / `#101b25` / `#2d0057`.
- **Surface** (`surface`): a step above `card`, used for nested panels — `#eef4f8` / `#16232e` / `#3a006e`.
- **Elevated** (`elevated`): the highest surface — modals, `GameResult`/`GamePauseOverlay` cards, `GameRules` sheets — `#ffffff` / `#1a2833` / `#420080`.
- **Border** (`border`): 1px hairlines around cards, chips, dividers — `#d9e3ea` / `#263746` / `#7b2fff`.
- **Progress Track** (`progressTrack`): unfilled portion of progress bars — `#d8e2ea` / `#223242` / `#4a1a7a`.
- **Accent Soft** (`accentSoft`): faint tint-tinted background wash for highlighted rows — `#e8f4ff` / `#10283c` / `#3d0070`.
- **Input / Header Background** (`inputBackground`, `headerBackground`): form field fill and nav-bar/tab-bar background respectively.

### Semantic
- **Success** (`successSurface` / `successBorder`): achievement unlocks, positive deltas — green family in light/dark (`#58a96b` / `#4da96b`), an electric green (`#39ff7f`) in crazy.
- **Warning** (`warning`): caution chips, low-signal states — amber (`#f5a623` / `#ffcc66`), yellow (`#ffe135`) in crazy.
- **Danger** (`danger` / `dangerSurface` / `dangerBorder`): destructive actions, error banners, "bomb" hazards in games — red family (`#d32f2f` / `#ef5350`), hot pink (`#ff5d8f`) in crazy.

### Named Rules
**The One Token Shape Rule.** Every palette exposes the identical 21 keys; a component that reads `theme.card` never needs to know whether it's rendering in light, dark, or crazy. Adding a new semantic color means adding it to all three palettes at once, never to one.

**The Absolute White Rule.** Icon/text glyphs painted directly onto `tint` (e.g. "Play Again" button icon, new-best sparkle) use a literal `#fff`, not `onTint`, in most shared components today — a minor inconsistency worth reconciling but not a blocker, since `tint`'s `onTint` value is white in two of three palettes anyway.

## Typography

**Body/UI Font:** system default (no custom font family loaded for UI text; only `SpaceMono` is loaded as an asset and is unused in current screens).

**Character:** Utilitarian and numeric-forward. Body copy stays light/regular; anything that represents a score, streak, or countdown jumps straight to `FontWeight.black` (900) with tightened letter-spacing, so numbers read as the emotional payload of a screen and everything else recedes.

### Hierarchy
(`constants/Typography.ts` — `FontSize` scale 11–48px, `FontWeight` regular(400)–black(900), consumed via `TextStyle` presets)

- **Hero Score** (`black` 900, 48px / `FontSize["5xl"]`, tight `-1` letter-spacing): the single largest number on screen — `GameResult`'s score display only.
- **Stat Value Large** (`black` 900, 40px, `-1` letter-spacing): big numeric stats (`TextStyle.statValueLarge`), e.g. profile/home stat tiles.
- **Result Title** (`semibold` 600 base / bumped to 20px in `GameResult`): the game-name heading on the result card.
- **Card Title** (`semibold` 600, 18px — `TextStyle.cardTitle`): list/card headings across Home, Games, Explore.
- **Body** (`regular` 400, 14px — `TextStyle.cardDesc`): card descriptions, secondary copy.
- **Button Primary** (`black` 900, 20px, `1px` letter-spacing — `TextStyle.buttonPrimary`): primary CTA labels.
- **Button Secondary** (`bold` 700, 16px, `0.5px` letter-spacing — `TextStyle.buttonSecondary`).
- **Stat Label** (`extrabold` 800, 11px, `1px` letter-spacing, uppercase — `TextStyle.statLabel`): the eyebrow above a stat number ("SCORE", "STREAK", "ROUND").
- **Hint** (`semibold` 600, 13px — `TextStyle.hint`): helper/instructional text.

### Named Rules
**The Numeral-Weight Rule.** Any text representing a live number (score, timer, stat) is `FontWeight.black`; no other UI text uses that weight. Weight is the visual signal for "this is the number that matters right now."

## Layout

No grid system or breakpoint scale exists — this is a single-column mobile app (Expo Router, portrait-first) with no tablet/desktop layout variant. Screens compose `View`/`ScrollView` with inline flex styles rather than a shared layout primitive. Density is driven entirely by the `Spacing` scale (`xs` 4px through `4xl` 32px in `constants/Spacing.ts`): `xs`/`sm` for tight internal gaps (icon-to-label, chip padding), `md`/`lg` for card internal padding and row gaps, `2xl`–`4xl` for screen-edge padding and full-bleed overlay insets. There is no responsive resizing logic; the same fixed spacing values apply across all supported phone sizes.

## Elevation & Depth

Mostly flat. The overwhelming majority of surfaces (cards, list rows, chips, tab bar) are distinguished by tonal layering — `background` → `card` → `surface` → `elevated`, each a step lighter/darker — and a 1px `border` hairline, not by shadow. `Shadow` (`constants/Spacing.ts`) is a two-entry vocabulary reserved for genuinely floating elements: game-result and pause overlays. Elsewhere, depth is implied, not cast.

### Shadow Vocabulary
- **Card** (`shadowColor: #000, offset 0/2, opacity 0.08, radius 6, elevation 3`): reserved for the rare card that needs to visually detach from its background; most cards use border + tonal layering instead.
- **Modal** (`shadowColor: #000, offset 0/4, opacity 0.12, radius 12, elevation 8`): `GameResult` and `GamePauseOverlay` cards — the only two components using this token today.

### Named Rules
**The Tonal-Layering Rule.** Reach for `card` → `surface` → `elevated` before reaching for a shadow. A shadow signals "this is floating above the whole screen" (a modal), not "this is a slightly raised card."

## Shapes

Radius is role-based, not size-based (`constants/Spacing.ts` `Radius` scale): `sm` (6px) for small markers/chips, `md` (10px) for medium chips, `card` (12px) for standard cards, `button` (14px) for action buttons, `panel` (16px) for info panels, `modal` (20px) for modals/result overlays, `xl` (24px) for large tap targets (e.g. the reaction-game pad), and `pill` (999px) for fully-rounded badges and icon buttons. Borders are consistently 1px and colored with the `border` token; there is no double-border or inset-shadow convention. Icon buttons (pause, reset, help "?") are uniformly circular 32–36px hit targets.

### Named Rules
**The Named-Radius Rule.** Radius values are chosen by *what the shape is for* (`button`, `modal`, `pill`), not by arbitrary pixel picking — new components should map onto an existing named role rather than introducing a bespoke radius.

## Components

### Buttons
- **Shape:** `Radius.button` (14px), or `Radius.pill` (999px) for compact icon-only buttons (pause/reset/help).
- **Primary:** `backgroundColor: theme.tint`, white icon/text (`#fff` literal), `TextStyle.buttonPrimary` label, `Spacing.md` vertical padding, flex-2 in paired action rows.
- **Secondary/Ghost:** `backgroundColor: theme.card`, `borderColor: theme.border`, 1px border, `theme.text`/`theme.mutedText` icon+label, flex-1 alongside the primary button.
- **Hover/Focus:** no hover state (native touch target); `Pressable` with `hitSlop` for icon buttons and a `useHaptic().tap()` call on every press — haptic feedback substitutes for a visual pressed state across the whole game-chrome layer.

### Cards / Containers
- **Corner Style:** `Radius.card` (12px) for content cards, `Radius.modal` (20px) for result/pause overlays.
- **Background:** `theme.elevated` for modal-tier cards (result, pause, rules sheet); `theme.card`/`theme.surface` for in-flow content cards.
- **Shadow Strategy:** `Shadow.modal` on the two overlay cards only; everything else flat + border (see Elevation & Depth).
- **Border:** 1px `theme.border` on nearly every card.
- **Internal Padding:** `Spacing["3xl"]` (28px) top/bottom on result-style cards, `Spacing.lg`–`Spacing.xl` on ordinary content cards.

### Overlays / Modals
- **GameResult** (`components/GameResult.tsx`): full-screen `rgba(0,0,0,0.55)` scrim, `ZoomIn` spring-entrance card, trophy icon or animated "New Best!" pill badge, bouncing score number (`withSpring` sequence), optional Best/Last/Streak stat row with `theme.border`-colored dividers, secondary Quit + primary Play Again buttons.
- **GamePauseOverlay** (`components/GamePauseOverlay.tsx`): `rgba(0,0,0,0.6)` scrim, pause-circle icon, stacked Resume (primary) / Restart (secondary) / Quit (secondary) buttons.
- **GameCountdown** (`components/GameCountdown.tsx`): `rgba(0,0,0,0.5)` scrim, 3-2-1-GO at 120px `FontWeight: "900"` (a literal string weight, not the `FontWeight` token), spring scale-in per tick, haptic tap per number and haptic success on "GO".
- **GameRules** (`components/GameRules.tsx`): circular "?" affordance (absolute-positioned top-right or inline), opens a `Modal` with `rgba(0,0,0,0.55)` scrim and an `elevated` card parsing rules text into emoji section headers / bullet lines / paragraphs.

### Navigation
- **Tabs** (`app/(tabs)/_layout.tsx`): four bottom tabs (Home, Games, Explore, Relax) via Expo Router `Tabs`; active/inactive icon color from `theme.tint`/`theme.tabIconDefault`, tab bar and header both painted `theme.headerBackground` with a `theme.border` top-border on the tab bar. Header-right cluster: active-ambient-sound stop chip, profile icon (with a `theme.tint` unread-achievement badge), settings icon.
- **Root Stack** (`app/_layout.tsx`): `(tabs)` root, plus pushed screens `game/[id]`, `content/[id]`, `destinations` (all default push presentation with a themed header), and modal-presentation screens `flight/edit`, `settings`, `profile`, `preflight`. `onboarding` is a gesture-disabled, header-hidden full-screen flow shown once on first launch.

## Do's and Don'ts

### Do:
- **Do** read every color through `Colors[colorScheme].<token>` (`constants/Colors.ts`) so light/dark/crazy render for free — never inline a literal hex for a color that exists as a token.
- **Do** use `Spacing`/`Radius`/`Shadow` (`constants/Spacing.ts`) and `FontSize`/`FontWeight`/`TextStyle` (`constants/Typography.ts`) instead of raw numeric literals for anything that recurs.
- **Do** reuse the shared game-chrome components (`GameResult`, `GameControls`, `GamePauseOverlay`, `GameCountdown`, `GameRules`) for every new game rather than rebuilding result/pause/countdown UI per game.
- **Do** pair every primary action with a `useHaptic()` call — it is the de facto pressed-state feedback across this system, not an optional flourish.

### Don't:
- **Don't** introduce a fifth theme mode or a fifth top-level color token without adding it to all three existing palettes (`light`/`dark`/`crazy`) in the same change.
- **Don't** add box-shadow to an ordinary card. Shadow is reserved for the two floating-overlay components; ordinary elevation is tonal (`card` → `surface` → `elevated`) plus a `border` hairline.
- **Don't** hardcode hex/rgba colors inside a game module. **Known, documented gap:** 28 of the 33 modules under `games/*/index.tsx` currently bypass `constants/Colors.ts` entirely and paint literal hex/`rgba()` values directly — this is incumbent debt, evidence for a future token-migration pass, not something this document prescribes fixing here. Any *new* game should route color through the theme tokens even though most existing ones don't.
