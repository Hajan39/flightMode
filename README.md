# Flight Mode

<p align="center">
  <strong>An offline-first travel companion for airplane passengers.</strong>
</p>

<p align="center">
  Games, calm, travel reading, and a lightweight flight tracker built for the hours when internet is unreliable, expensive, or completely gone.
</p>

<p align="center">
  <img alt="Expo SDK" src="https://img.shields.io/badge/Expo-55-000020?style=for-the-badge&logo=expo&logoColor=white" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.83-61DAFB?style=for-the-badge&logo=react&logoColor=111111" />
  <img alt="Offline First" src="https://img.shields.io/badge/Offline--first-ready-0E8F68?style=for-the-badge" />
  <img alt="EAS" src="https://img.shields.io/badge/EAS-builds-4630EB?style=for-the-badge&logo=expo&logoColor=white" />
</p>

---

## What Is Flight Mode?

Flight Mode is a mobile app for people who are about to board, already in the air, or stuck somewhere between boredom and bad cabin Wi-Fi.

The app is intentionally simple: it does not need accounts, live APIs, maps, or internet access to be useful. It gives passengers small things to do, read, track, and relax with while their phone is in airplane mode.

## Core Features

- Offline mini games with local progress, streaks, best scores, and achievements.
- Relax tools with breathing guidance, ambient audio, volume presets, haptics, and sleep timers.
- Static travel content with optional remote article sync when a content endpoint is configured.
- Lightweight manual flight-duration tracker.
- Local profile stats and achievement history.
- Anonymous analytics support through PostHog when explicitly configured.
- OTA updates through Expo Updates for JavaScript, TypeScript, content, and translation changes.

## Product Principles

- Offline-first is non-negotiable.
- The app should be useful before and during a flight, not only after a login.
- Core gameplay and relaxation must never require a backend.
- Analytics must stay anonymous and must not include personal data, exact location, flight numbers, or free-form user text.
- Features should pass one simple filter: does this help the user survive the flight?

## Tech Stack

| Area | Stack |
| --- | --- |
| App runtime | Expo 55, React 19, React Native 0.83 |
| Routing | Expo Router |
| State | Zustand |
| Persistence | AsyncStorage via `zustand/persist` |
| Audio | `expo-audio` |
| Updates | `expo-updates` + EAS Update |
| Build and submit | EAS Build / EAS Submit |
| Analytics | PostHog React Native, anonymous-only configuration |
| Styling | React Native `StyleSheet` and local theme tokens |

## Project Structure

```text
app/
  _layout.tsx              Root navigation stack
  onboarding.tsx           First-run onboarding
  profile.tsx              Stats and achievements modal
  settings.tsx             Preferences, sync, privacy, support
  (tabs)/                  Home, Games, Explore, Relax
  game/[id].tsx            Game detail route
  content/[id].tsx         Article detail route
  flight/edit.tsx          Manual flight setup/editing

components/                Shared UI and game UX components
constants/                 Colors, spacing, typography
data/                      Game registry, achievements, bundled content
games/                     Self-contained game modules
hooks/                     Translation, content, profile stats, haptics
i18n/locales/              UI translations
store/                     Zustand stores
utils/                     Analytics, sync, notifications, storage helpers
documents/                 Product status, backlog, privacy policy
scripts/                   Release and OTA helper scripts
```

## Getting Started

### Requirements

- Node.js 20+
- npm
- Expo CLI through `npx expo`
- EAS CLI through `npx eas-cli` for builds and releases

### Install

```bash
npm install
```

### Run Locally

```bash
npm run start
```

Platform shortcuts:

```bash
npm run android
npm run ios
npm run web
```

### Check Expo Compatibility

```bash
npx expo-doctor
npx expo install --check
```

Use Expo-managed versions for native dependencies. Avoid broad `ncu -u` upgrades unless you are deliberately upgrading the Expo SDK.

## Build And Release

### Android Build

```bash
npm run eas:build:android
```

### Android Build And Submit

```bash
npm run deploy:android
```

The production submit profile currently targets Google Play production with `releaseStatus: draft`.

### OTA Updates

```bash
npm run ota:preview
npm run ota:production
```

OTA update messages are derived from the `CHANGELOG.md` `Unreleased` section by `scripts/eas-update-from-changelog.js`. Keep that section accurate before publishing an update.

### Automatic Main Release Workflow

Pushes to `main` are handled by `.github/workflows/release-main.yml`:

- Native or build-sensitive changes trigger an Android EAS build and submit.
- App-code/content/translation-only changes publish an OTA update to production.

Build-sensitive paths include:

- `app.json`
- `app.config.js` / `app.config.ts`
- `eas.json`
- `package.json`
- `package-lock.json`
- `babel.config.js`
- `metro.config.js`
- `android/**`
- `ios/**`
- `plugins/**`

Required GitHub secret:

- `EXPO_TOKEN`

## Environment Variables

The app works without environment variables for normal offline use.

Optional variables:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_POSTHOG_KEY` | Enables anonymous PostHog analytics |
| `EXPO_PUBLIC_POSTHOG_HOST` | Optional custom PostHog host |
| `EXPO_PUBLIC_ANALYTICS_ENABLED=false` | Disables analytics sink initialization |
| `EXPO_PUBLIC_STRAPI_CONTENT_URL` | Optional Strapi article source |
| `EXPO_PUBLIC_CONTENT_SYNC_URL` | Optional generic JSON article source |

Do not put secrets in the mobile app bundle. Public Expo variables are visible to clients.

## Source Of Truth

The most current operational docs live here:

- `CHANGELOG.md` - release notes and active `Unreleased` changes
- `documents/app-status-and-changelog.md` - current product state and dated changelog
- `documents/todo-and-improvements.md` - prioritized backlog and proposed work
- `documents/privacy-policy.md` - public privacy policy text

Actual code wins over older planning documents when there is drift.

## Development Notes

### Games

Game metadata is centralized in `data/games.ts`. Each game lives in `games/<id>/index.tsx` and should record results through `useGameStore().updateProgress()`.

When adding or renaming a game, check:

- `data/games.ts`
- `app/game/[id].tsx`
- Home and Games discovery surfaces
- Profile/stat mappings
- locale files for title, description, and rules keys

### Content

Bundled articles live in `data/content.json`. Content can be localized per field, with English as the fallback. Remote sync is optional and must not break bundled offline content.

### Localization

Translations live in `i18n/locales/*.ts`. Add new UI copy across all supported locales or use a deliberate fallback plan.

### Persistence

Persisted state uses Zustand middleware and AsyncStorage. Store keys, game IDs, and achievement IDs should be treated carefully because changing them can orphan user data.

### Analytics

Analytics events must remain anonymous. Do not include personal data, exact location, flight numbers, emails, names, or free-form user text.

## Current Non-Goals

- Required sign-in or user accounts
- Required backend access for core features
- Flight API lookup as a core dependency
- Network multiplayer
- NativeWind migration
- MMKV migration
- Online-only gameplay or online-only content

## Support

Flight Mode includes a subtle supporter link in Settings. The current support funnel is tracked with anonymous events:

- `support_opened`
- `support_clicked`
- `support_completed`

The support link is optional and does not gate any core functionality.

## License

This repository currently does not declare an open-source license. Treat the code as proprietary unless a license is added.
