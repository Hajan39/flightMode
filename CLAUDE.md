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
```

No test runner or lint script is configured. Validate with TypeScript Problems panel.

## Architecture

**Stack:** Expo 55 · React Native 0.83 · React 19 · Expo Router · Zustand 5 · AsyncStorage · expo-audio · PostHog

**Navigation:** Expo Router. Root stack in `app/_layout.tsx`. Main tabs in `app/(tabs)/`. Detail routes: `app/game/[id].tsx`, `app/content/[id].tsx`, `app/flight/edit.tsx`. Profile and settings are modal stack screens.

**State:** Zustand stores with AsyncStorage persist. Never introduce a new global state layer.
- `store/useGameStore.ts` — game progress (`lastScore`, `currentStreak`, `bestStreak`), migration version 2
- `store/useSettingsStore.ts` — theme, language, sync policy
- `store/useFlightStore.ts` — manual flight duration
- `store/useAchievementStore.ts` — unlock history
- `store/useAudioStore.ts` — ambient audio (has `any` typing debt)
- `store/useNetworkStore.ts` — online/offline, not persisted

**Styling:** React Native `StyleSheet` + inline styles. Theme tokens in `constants/Colors.ts`. Four modes: `system / light / dark / crazy`. No NativeWind.

**Localization:** `hooks/useTranslation.ts` → `i18n/locales/*.ts`. 12 languages (`en/cs/de/es/fr/hi/it/ja/ko/pl/pt/zh`). Content (`data/content.json`) is fully localized for `en/cs/de` only.

## Games

19 games. Single source of truth: **`data/games.ts`** (`gameRegistry`).

Each game is a self-contained module at `games/<id>/index.tsx`. All games must call `useGameStore().updateProgress()` to record results.

Shared game UX components (use these, don't reinvent):
- `components/GameResult.tsx` — result overlay with Best/Last/Streak
- `components/GameControls.tsx` — pause + reset strip
- `components/GamePauseOverlay.tsx` — Resume / Restart / Quit
- `components/GameCountdown.tsx` — 3-2-1 intro with haptics

**To add a game:**
1. Create `games/<id>/index.tsx`
2. Register in `data/games.ts`
3. Add translation keys (`titleKey`, `descriptionKey`, `rulesKey`) to all locale files
4. Wire `loadComponent` via `require("@/games/<id>").default`
5. Ensure `updateProgress()` is called on game end

**Timer rule:** timed games must derive elapsed time from `Date.now()` wall-clock deadlines, not chained JS `setTimeout` ticks — fast taps can inflate tick-based timers.

## Content

Static articles in `data/content.json`. Served through `hooks/useContentItems.ts` which merges bundled data with optional remote sync cache (`store/useContentStore.ts`). Remote endpoint is optional via `EXPO_PUBLIC_STRAPI_CONTENT_URL` or `EXPO_PUBLIC_CONTENT_SYNC_URL`; app is fully offline without it.

## Analytics

PostHog via `utils/analytics.ts`. Active only when `EXPO_PUBLIC_POSTHOG_KEY` is set (or `EXPO_PUBLIC_ANALYTICS_ENABLED=false` to disable). Payloads must never contain personal data, exact location, flight number, or free-form user text. Offline UX must never depend on analytics upload success.

## OTA Publish Rules

- Only publish when user explicitly asks
- Update `CHANGELOG.md` `Unreleased` section **before** publishing
- Use `npm run ota:preview` / `npm run ota:production` — scripts derive EAS message from `Unreleased`
- OTA is safe only for JS/TS, translations, compatible asset fixes — never for native dependency or `app.json` changes

## Known Debt

- Hook dependency warnings across multiple files
- Index-based list keys in several components
- `any` in `useAudioStore`
- `GameRules` contains a regex that triggers a lint/compile warning
- `hooks/useProfileStats.ts` missing some games in estimated-minutes mapping
- Flight edit resets `departureTime`

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
