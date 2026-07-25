# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start            # dev server (Expo Go / simulator)
npm run android          # open on Android
npm run ios              # open on iOS
npm run web              # open in browser

npm run ota:preview -- "message"    # OTA update to preview channel
npm run ota:production -- "message" # OTA update to production channel
npm run eas:build:android           # EAS native build
npm run deploy:android              # EAS build + auto-submit
npm run deploy:internal             # EAS build + submit to Internal testing (generates pre-launch report)

npm test                            # Jest (jest-expo) — pure logic/data tests in __tests__/
```

Jest (`jest-expo`) is configured for fast, pure-logic/data tests in `__tests__/` (locale parity, game-registry & achievement integrity, destinations, Sudoku puzzle validity) — run `npm test`. These do NOT render RN components. No lint script; also validate with `npx tsc --noEmit`.

## Architecture

**Stack:** Expo 56 · React Native 0.85 · React 19 · Expo Router · Zustand 5 · AsyncStorage · expo-audio · PostHog

**App version:** 1.3.0 (in `app.json`). Bundle IDs: `com.hajan39.flightmode` (iOS + Android).

**Navigation:** Expo Router. Root stack in `app/_layout.tsx`. Main tabs in `app/(tabs)/`. Detail routes: `app/game/[id].tsx`, `app/content/[id].tsx`, `app/flight/edit.tsx`. Profile, settings, and `app/preflight.tsx` (offline-readiness) are modal stack screens; `app/destinations.tsx` (destination tips) is a pushed card screen. Onboarding flow at `app/onboarding.tsx`.

**Tab screens:**
- `(tabs)/index.tsx` — Home (daily challenge, quick actions, flight utility, recommendations)
- `(tabs)/games.tsx` — Game discovery with search + category/intent filters
- `(tabs)/explore.tsx` — Article/content browsing
- `(tabs)/relax.tsx` — Breathing exercise + ambient audio + sleep timer

**State:** Zustand stores with AsyncStorage persist. Never introduce a new global state layer.
- `store/useGameStore.ts` — game progress (`lastScore`, `currentStreak`, `bestStreak`, `levelStars?`), migration version **3**
- `store/useSettingsStore.ts` — theme, language, sync policy
- `store/useFlightStore.ts` — manual flight duration; exports `getElapsedMinutes()`, `getRemainingMinutes()`, `getFlightProgress()`
- `store/useAchievementStore.ts` — unlock history, session counters (flights, relax, articles, sounds, streak)
- `store/useAudioStore.ts` — ambient audio player, sleep timer; **not persisted** (has `any` typing debt)
- `store/useNetworkStore.ts` — online/offline + network type; **not persisted**
- `store/useContentStore.ts` — optional remote article sync; persists items/version/lastSyncAt only
- `store/useDiscoveryStore.ts` — `seenGameIds` for the Home "New to try" row (persisted)
- `store/useImageCacheStore.ts` — remote article image cache (url → local uri)

**Styling:** React Native `StyleSheet` + inline styles. Design tokens:
- `constants/Colors.ts` — theme palettes: `light`, `dark`, `crazy` (text, background, tint, card, surface, elevated, border, mutedText, etc.)
- `constants/Spacing.ts` — `Spacing` (xs–4xl) and `Radius` and `Shadow` presets
- `constants/Typography.ts` — `FontSize`, `FontWeight`, `TextStyle` presets (statLabel, cardTitle, buttonPrimary, etc.)

Four theme modes: `system / light / dark / crazy`. No NativeWind.

**Localization:** `hooks/useTranslation.ts` → `i18n/locales/*.ts`. 12 languages (`en/cs/de/es/fr/hi/it/ja/ko/pl/pt/zh`). Language preference order: stored > system > en. Content (`data/content.json`) is fully localized for `en/cs/de` only.

**Types:** `types/game.ts` (GameProgress, GameConfig, GameCategory, GameDifficulty, GamePlayMode), `types/flight.ts` (Flight), `types/content.ts` (ContentItem).

## Games

33 games. Single source of truth: **`data/games.ts`** exports `gameRegistry`, `gamesById`, `dailyChallengeGames`, `playTogetherGames`, `getGameById()`.

Each game is a self-contained module at `games/<id>/index.tsx`. All games must call `useGameStore().updateProgress()` to record results.

**Complete game list:**

| ID | Category | Difficulty | Notes |
|---|---|---|---|
| `memory` | brain | easy | Card matching |
| `reaction` | reflex | easy | Reaction timer; daily challenge |
| `sky-math` | brain | medium | Math quiz; daily challenge |
| `quiz` | brain | medium | Trivia |
| `runway-landing` | reflex | medium | Landing minigame; daily challenge |
| `cabin-call` | reflex | medium | Crew-command icon matching (visual, not audio); daily challenge |
| `air-traffic-control` | strategy | hard | Flight routing |
| `flight-path` | strategy | hard | Plane-type runway matching |
| `sky-defense` | strategy | hard | Tower defense |
| `stack-sort` | brain | hard | Sorting puzzle; tracks `levelStars` |
| `duel-tictactoe` | multiplayer | medium | Shared-screen; 3×3 + 5×5 |
| `duel-dice` | multiplayer | easy | Pass-and-play |
| `duel-connect4` | multiplayer | medium | Shared-screen |
| `duel-emoji-find` | multiplayer | easy | Pass-and-play |
| `duel-hangman` | multiplayer | medium | Pass-and-play; supports 1-player |
| `cross-air-radar` | multiplayer | medium | Pass-and-play; Battleship-style |
| `cross-code-breaker` | multiplayer | hard | Pass-and-play; Mastermind |
| `cross-liars-dice` | multiplayer | hard | Pass-and-play |
| `twenty-forty-eight` | brain | hard | 2048 sliding-tile puzzle; 15 min |
| `minesweeper` | strategy | medium | Classic mine-sweeping; 10 min |
| `word-scramble` | brain | medium | Unscramble aviation words; daily challenge |
| `color-clash` | brain | medium | Stroop test; daily challenge |
| `simon-says` | brain | medium | Memory sequence; daily challenge |
| `whack-mole` | reflex | easy | Tap moles; daily challenge |
| `higher-lower` | reflex | easy | Predict numbers |
| `odd-one-out` | brain | easy | Find the odd emoji; daily challenge |
| `word-guess` | brain | medium | Wordle-style; daily challenge |
| `sudoku` | brain | hard | 9×9 logic puzzle; 15 hardcoded puzzles |
| `snake` | reflex | medium | Classic snake; D-pad controls |
| `cabin-lights` | brain | medium | Lights Out puzzle; 5 rounds 3×3→5×5 |
| `sliding-puzzle` | brain | medium | Classic 15-puzzle (4×4 sliding tiles) |
| `cargo-catch` | reflex | medium | Catch falling cargo, dodge bombs; 60s |
| `word-search` | brain | medium | Find hidden words in an 8×8 letter grid |

**Daily challenge games:** `sky-math`, `reaction`, `runway-landing`, `cabin-call`, `word-scramble`, `color-clash`, `simon-says`, `whack-mole`, `odd-one-out`, `word-guess` (derived from `isDailyChallenge` in `data/games.ts` — do not hand-maintain)

**Play modes:** `bestOf` · `passAndPlay` · `sharedScreen` · `crossDevice`

Shared game UX components (use these, don't reinvent):
- `components/GameResult.tsx` — result overlay with Best/Last/Streak + "New Best!" badge
- `components/GameControls.tsx` — floating pause + reset button row
- `components/GamePauseOverlay.tsx` — Resume / Restart / Quit modal
- `components/GameCountdown.tsx` — 3-2-1-GO overlay with haptic ticks
- `components/GameRules.tsx` — rules display (has a regex that triggers a lint warning — known debt)

**To add a game:**
1. Create `games/<id>/index.tsx`
2. Register in `data/games.ts`
3. Add translation keys (`titleKey`, `descriptionKey`, `rulesKey`) to all 12 locale files
4. Wire `loadComponent` via `require("@/games/<id>").default`
5. Ensure `updateProgress()` is called on game end

**Timer rule:** timed games must derive elapsed time from `Date.now()` wall-clock deadlines, not chained JS `setTimeout` ticks — fast taps can inflate tick-based timers.

## Content

44 bundled articles in `data/content.json` (localized en/cs/de). Served through `hooks/useContentItems.ts` which merges bundled data with optional remote sync cache (`store/useContentStore.ts`).

Remote endpoint is optional via `EXPO_PUBLIC_STRAPI_CONTENT_URL` or `EXPO_PUBLIC_CONTENT_SYNC_URL`; app is fully offline without it. Sync respects `syncNetworkPolicy` (wifi_only / wifi_and_mobile / off) and has a 30-minute cooldown between syncs.

`utils/contentSync.ts` handles fetch + normalization of both Strapi and generic JSON schemas.

## Achievements

Defined in `data/achievements.ts`. Categories: `player`, `quiz`, `relax`, `traveler`, `streak`, `special`. Checked in `store/useAchievementStore.ts` via `checkAndUnlock()`, which is called automatically after `updateProgress()`.

`useAchievementStore` tracks: `unlockedIds`, `newUnlockedIds` (cleared by `AchievementToast`), `totalFlights`, `totalRelaxSessions`, `articlesRead`, `soundsPlayed`, `lastActiveDate`, `streakDays`.

## Analytics

PostHog via `utils/analytics.ts`. Active only when `EXPO_PUBLIC_POSTHOG_KEY` is set (or `EXPO_PUBLIC_ANALYTICS_ENABLED=false` to disable). Anonymous-only: no person profiles, no geo, no session replay.

**Hard rules for analytics payloads:** never include personal data, exact location, flight number, or free-form user text. Offline UX must never depend on analytics upload success.

Event queue (max 100) is buffered until the PostHog sink is ready. `components/AnalyticsProvider.tsx` initializes PostHog; `components/NetworkStatusBootstrap.tsx` and `components/ContentSyncBootstrap.tsx` wire up network/sync lifecycle events.

## Shared Hooks

- `hooks/useTranslation.ts` — `t()` + language management
- `hooks/useProfileStats.ts` — derived stats from game + achievement stores (estimated-minutes uses the registry `estimatedTime` for every game)
- `hooks/useContentItems.ts` — merged content (bundled + remote)
- `hooks/useOTAUpdate.ts` — Expo OTA update integration
- `hooks/useHaptic.ts` — haptic feedback (tap, success, heavy, etc.)
- `hooks/useFadeIn.ts` — fade-in animation
- `hooks/useAnimatedPress.ts` — animated press feedback

## Release Automation (CI/CD)

GitHub Actions in `.github/workflows/`:

- **`ci.yml`** — on every push and PR: `npx tsc --noEmit` + `npm test`. This is the quality gate; keep it green.
- **`release-main.yml`** — on push to **`main`** (or manual `workflow_dispatch`): a `decide` job inspects the diff and **auto-picks the release lane**:
  - **Build lane** (if any *breaking-sensitive* file changed: `app.json`, `app.config.*`, `eas.json`, `package.json`, `package-lock.json`, `babel.config.js`, `metro.config.js`, `plugins/**`, `android/**`, `ios/**`) → `eas build --platform android --auto-submit --profile production` (native AAB + submit to the production track as draft; version code auto-increments via `autoIncrement`).
  - **OTA lane** (only JS/TS, translations, data, compatible assets changed) → `npm run ota:production` (derives the message from `CHANGELOG.md` `Unreleased`).
  - Requires the `EXPO_TOKEN` repo secret.
- **`claude.yml` / `claude-code-review.yml`** — Claude Code GitHub app hooks.

**Implication: merging to `main` auto-releases.** So the OTA-vs-native-build safety decision is automated — you never need to hand-pick. Just make sure `CHANGELOG.md` `Unreleased` is current before merging (the OTA lane uses it as the update message). To release without merging to main, or to test first, use `npm run deploy:internal` (build → internal testing track → pre-launch report).

## OTA Publish Rules

- Publishing happens automatically via `release-main.yml` on push to `main` (see above). Manual `npm run ota:preview` / `npm run ota:production` is for out-of-band publishes.
- Update `CHANGELOG.md` `Unreleased` section **before** merging/publishing — the scripts derive the EAS message from it.
- OTA is safe only for JS/TS, translations, compatible asset fixes — never for native dependency or `app.json` changes. The `release-main` `decide` job enforces this automatically by routing native/config changes to a full build instead of OTA.

## Known Debt

- Hook dependency warnings across multiple files
- Index-based list keys in several components
- `any` in `useAudioStore`

Don't fix these silently during unrelated work.

## Documentation Rules

After any change affecting product behavior, UX flow, feature scope, or data model — update:
- `documents/app-status-and-changelog.md` (as-is snapshot + dated changelog)
- `documents/todo-and-improvements.md` (backlog/priorities)
- `CHANGELOG.md` (`Unreleased` section, Keep a Changelog format)

Never create additional overlapping status docs.

## Product Vision

**North star:** Be the first app people download before a flight — the default offline companion.

**Success metrics (not vanity):**
- Retention: does user return for next flight?
- Session time: how long during a flight?
- Repeat use: 2+ sessions per user

**Decision filter for every feature:** "Does this help the user survive the flight?" If no — don't build it.

### Roadmap phases

**Phase 1 — Not Boring (current)**
Goal: user stays engaged 10–20 minutes.
- Polish 3–5 core games
- Good feedback loops, replay value, haptics
- Unified game UX (GameResult, streaks, best scores)

**Phase 2 — Useful (next)**
Goal: user opens app *before* the flight.
- Destination content, airport tips
- "Download before flight" flow
- Smart recommendations without backend

**Phase 3 — Habit**
Goal: automatic behavior — "I'm flying → I open FlightMode"
- Streaks, daily challenges
- Better personalization
- Content updates via Strapi

**Phase 4 — Monetization**
Only after retention is proven.
- Premium: more games, content, audio
- Affiliate post-landing: hotels, activities
- No ads, no paywalls on core UX

**Phase 5 — Scale**
- More content, languages, destinations
- Better onboarding

### Anti-patterns to avoid
- Too many features → kills focus
- Monetization too early → kills growth
- Complexity → users don't get it
- Any feature that requires internet for core gameplay
