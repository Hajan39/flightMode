# Copilot Instructions for Flight Mode

These instructions describe the current reality of the Flight Mode codebase. Follow them over older aspirational docs when they conflict.

## Product Summary

Flight Mode is an offline-first Expo React Native app for airplane passengers. The implemented product currently combines:

- offline mini games
- static travel content
- relaxation features with breathing and ambient audio
- a lightweight flight duration tracker
- local profile stats and achievements

There is no authentication, no backend, and no required internet connection during normal use.

## Source of Truth

Treat actual code as source of truth first. The maintained operational docs are:

- `documents/app-status-and-changelog.md`
- `documents/todo-and-improvements.md`
- `CHANGELOG.md`

Older aspirational planning docs were intentionally removed to reduce drift.

Current implementation facts:

- storage uses Zustand persist with AsyncStorage, not MMKV
- styling is mostly `StyleSheet` and inline React Native styles, not NativeWind
- runtime audio playback is implemented with `expo-audio`
- flight setup is manual duration input only; there is no flight API integration in the app today

## Core Architecture

### Navigation

- Routing uses Expo Router.
- Root stack is in `app/_layout.tsx`.
- Main tabs live in `app/(tabs)`.
- Detail routes exist for `app/game/[id].tsx`, `app/content/[id].tsx`, and `app/flight/edit.tsx`.
- `profile` and `settings` are modal stack screens.

### State Management

Use the existing Zustand stores instead of introducing new global patterns.

Current stores:

- `store/useSettingsStore.ts`
- `store/useFlightStore.ts`
- `store/useGameStore.ts`
- `store/useAchievementStore.ts`
- `store/useAudioStore.ts`

Rules:

- keep global state minimal
- prefer local component state unless multiple screens need the data
- persist only user-relevant state
- use selectors when reading store state in components

### Persistence

- persisted stores use `zustand/middleware` with AsyncStorage
- data is JSON-serialized automatically through `createJSONStorage`
- do not add backend assumptions to core features

### Games

Games are self-contained modules under `games/<game-id>/index.tsx`.

Important constraint: game metadata is currently duplicated across multiple files. When adding or renaming a game, check all of these places:

- `app/(tabs)/games.tsx`
- `app/game/[id].tsx`
- `app/(tabs)/index.tsx`
- `app/profile.tsx`
- `hooks/useProfileStats.ts`
- locale files for title, description, and rules keys

When adding a new game:

1. add the game component under `games/<id>/index.tsx`
2. register the route mapping in `app/game/[id].tsx`
3. add the list card in `app/(tabs)/games.tsx`
4. add translation keys for name, description, and rules
5. update profile/stat mappings if needed
6. make sure the game writes results through `useGameStore().updateProgress()`

### Content

- static content lives in `data/content.json`
- content detail screen is `app/content/[id].tsx`
- content items use localized fields with English fallback
- many articles are English-only; do not assume every locale is complete

### Localization

- translation entry point is `hooks/useTranslation.ts`
- translation dictionaries live in `i18n/locales/*.ts`
- supported languages are declared in `i18n/translations.ts`
- when adding new UI copy, add it to all locale files or provide a deliberate fallback plan

### Theming

- resolved theme comes from `components/useColorScheme.ts`
- available modes are `system`, `light`, `dark`, and `crazy`
- theme tokens live in `constants/Colors.ts`
- reuse theme tokens before adding raw colors

### Audio and Relax

- ambient audio is controlled centrally through `useAudioStore`
- Relax screen owns breathing UI, but audio state is shared globally
- header controls can stop active playback, so avoid screen-local audio ownership patterns

## Implementation Guidance

### Preserve the current product shape

Do not assume the app is a full flight assistant. Today it is mainly:

- a games hub
- a travel content reader
- a relaxation companion
- a simple flight duration tracker

If you extend the flight feature, keep new behavior explicit and pragmatic.

### Prefer consistency over abstraction

This codebase is small enough that simple patterns are better than ambitious architecture.

- prefer focused components
- prefer explicit mappings over meta-frameworks
- avoid new dependencies unless there is clear leverage
- do not introduce Redux, MobX, React Query, or backend-only patterns without strong reason

### Be careful with duplicated registries

The biggest structural risk is metadata drift across games. If you touch game IDs, titles, categories, scores, or rules, verify all registry-like files stay aligned.

### Keep offline-first intact

- normal app usage must work offline
- remote APIs must remain optional
- do not introduce sign-in flows, server-required content, or online-only gameplay for existing features unless explicitly requested

### Respect current persistence semantics

- changing store keys can break existing persisted state
- changing game IDs can orphan user progress
- changing achievement IDs can orphan unlock history

## Known Technical Debt

Be aware of these existing issues before making broad changes:

- hook dependency warnings in multiple files
- index-based keys in some rendered lists
- `any` usage in `useAudioStore`
- `GameRules` contains a regex that currently triggers a compile/lint problem
- `hooks/useProfileStats.ts` does not include all games in estimated minutes mapping
- flight editing resets `departureTime`

Do not silently refactor all of this during unrelated work. Fix the minimum necessary scope unless the task is explicitly cleanup-oriented.

## Preferred Change Strategy

1. inspect current files before editing
2. make small, local changes
3. preserve existing route names, store keys, and game IDs unless migration is intentional
4. update translations together with UI changes
5. validate with problems/errors after edits

## Deployment Guidance

For this repository, do not publish Expo OTA updates automatically as the default end of a task.

Instead, when a task changes user-visible app behavior that is compatible with Expo OTA updates:

1. finish code changes and validation first
2. update `CHANGELOG.md` in the `Unreleased` section with the shipped user-facing changes
3. only publish an OTA update when the user explicitly asks for it

When an OTA publish is requested, use the `Unreleased` section from `CHANGELOG.md` as the source for the EAS update message instead of inventing a separate ad-hoc summary.

Important limitation: EAS Update exposes an update `message`, not a dedicated release-notes field. Treat the changelog-derived update message as the release notes equivalent for OTA publishes in this repo.

Treat OTA publish as allowed only for:

- JavaScript or TypeScript code changes
- translation or content updates
- asset-compatible UI fixes that do not require a native rebuild

Do not publish OTA when the change includes any of the following unless the user explicitly asks for it and the deployment path is confirmed:

- native dependency changes
- Expo config or plugin changes that require a rebuild
- `app.json` or native capability changes that alter update compatibility
- runtime version changes
- build/signing/release issues that make OTA safety unclear

Preferred OTA commands:

- `npm run ota:preview`
- `npm run ota:production`

OTA publish workflow rules:

1. update `CHANGELOG.md` before attempting the publish
2. use the changelog-driven OTA script so `Unreleased` is sent as the EAS update message
3. publish to the requested branch/environment only after explicit user confirmation
4. report the derived update message, update group, platform update IDs, and any publish warnings or failures in the final response
5. if a publish attempt fails, retry once with the same changelog-derived message before giving up

## Documentation Guidance

If any change affects product behavior, feature scope, UX flow, or key implementation facts, you MUST update:

- `documents/app-status-and-changelog.md`
- `documents/todo-and-improvements.md` (when priorities or proposed work change)

Documentation rules:

- keep `app-status-and-changelog.md` as the single as-is snapshot + dated changelog
- keep `todo-and-improvements.md` as the single backlog/prioritization source
- keep `CHANGELOG.md` in Keep a Changelog style with an `Unreleased` section and grouped change types
- treat `package.json` version as the release source of truth for changelog sections
- when releasing, move completed `Unreleased` items into a new semver section like `## [1.1.0] - YYYY-MM-DD`
- avoid creating additional overlapping status docs unless explicitly requested
- when work is completed, move intent from TODO doc into changelog entry