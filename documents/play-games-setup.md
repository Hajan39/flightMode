# Google Play Games Services (PGS) — setup guide

The **code side is already scaffolded** and committed (guarded, inert — it does
nothing until the steps below are done, so it can't break the shipped 1.3.0).
This doc is the checklist for the parts that need your Play Console / Google
Cloud accounts and a native dev build — things that can't be done from the repo.

## What's already in the repo

| File | Role |
|---|---|
| `utils/playGames.ts` | Guarded wrapper: silent sign-in + `unlockPlayGamesAchievement()`. No-op when no native module is linked. |
| `data/playGamesAchievements.ts` | `localAchievementId → Play ID` map (all 30 achievements, values currently `null`). |
| `store/useAchievementStore.ts` | Fire-and-forget push to PGS after each local unlock. |
| `components/PlayGamesBootstrap.tsx` | Kicks off silent sign-in on launch (mounted in `app/_layout.tsx`). |
| `plugins/withPlayGames.js` | Expo config plugin: adds the `app_id` string, the manifest metadata, **and the `play-services-games-v2` gradle dependency** (links the SDK into the AAB). Wired in `app.json` with the real app id `944569415010`. |
| `modules/play-games/` | Local Android-only Expo module (Kotlin) wrapping Play Games v2 — sign-in, unlock/increment achievement, show overlay. Autolinked from `./modules`. |
| `__tests__/playGamesAchievements.test.ts` | Fails CI if the map drifts from `data/achievements.ts`. |

Everything is behind try/catch. The local (offline) achievement unlock is always
the source of truth; PGS is a best-effort mirror.

## Step 1 — Play Console: create the PGS project

1. Play Console → your app → **Play Games Services → Setup and management → Configuration**.
2. Create a new Play Games Services project, link it to the app `com.hajan39.flightmode`.
3. Note the numeric **project / app id** (looks like `1234567890`). You'll need it in Step 4.

## Step 2 — Google Cloud: OAuth 2.0 credentials

1. In the linked Google Cloud project, create an **OAuth 2.0 Client ID → Android**.
2. Package name: `com.hajan39.flightmode`.
3. **SHA-1**: use the SHA-1 of the **Play app-signing** key (Play Console → Setup →
   App integrity → App signing key certificate), **not** your upload key — otherwise
   sign-in works in internal testing but fails in production.
   - For local dev builds you'll also want the SHA-1 of the debug/dev keystore added as
     a second OAuth client, or sign-in won't work on the dev build.
4. Back in Play Games Services → **Credentials**, add the OAuth client(s) and the
   game server credential if prompted.

## Step 3 — Define the achievements

In Play Games Services → **Achievements**, create one achievement per row of
`data/playGamesAchievements.ts` (30 total). Titles/descriptions can mirror our
i18n strings. Each gets a `CgkI...` id — paste it as the value for the matching
local id:

```ts
// data/playGamesAchievements.ts
"first-game": "CgkIxxxxxxxxxxxx",   // was null
```

You can do these incrementally — any row left `null` just won't be pushed to
Play (its local unlock still works). CI's `playGamesAchievements.test.ts`
enforces the `CgkI` prefix so a typo/placeholder fails the build.

## Step 4 — Link the SDK into the build ✅ DONE

Done in the repo (`plugins/withPlayGames.js` + `app.json`):

```jsonc
"plugins": [ /* ...existing... */, "./plugins/withPlayGames" ],
"extra": { "playGamesAppId": "944569415010" }
```

At prebuild the config plugin now:
- adds `<string name="app_id">944569415010</string>` to `strings.xml`,
- adds the `com.google.android.gms.games.APP_ID` → `@string/app_id` manifest
  meta-data, and
- adds `implementation 'com.google.android.gms:play-services-games-v2:21.0.0'`
  to `app/build.gradle` — **this is what puts the SDK into the AAB**, satisfying
  Play Console's "Add the Play Games Services SDK to your APK" gate.

**This touches `app.json` + `plugins/`, so `release-main`'s `decide` job routes it
to a full native build** — exactly what's needed to get the SDK into the
production AAB. (⚠️ The native EAS build can't be run/verified from the repo
sandbox; verify via an internal build or the pre-launch report before trusting
the production submit — see Step 6.)

### What this alone gives you

Play Games Services **v2 auto-initializes and auto-signs-in** the player on launch
purely from the linked SDK + `APP_ID` metadata — **no JS/native bridge required**.
So once this build ships to a track, you get: the Google Play Games sign-in on
launch, the Play Games gate satisfied, and Sidekick eligibility. What you do NOT
yet get is **pushing achievement unlocks from our JS** — that needs Step 5.

## Step 5 — Native bridge for achievement unlocks ✅ SCAFFOLDED (needs a build to verify)

A custom **local Expo module** at `modules/play-games/` (New-Architecture-safe,
Android-only) now wraps Play Games Services v2 — no unmaintained community lib.

- `modules/play-games/android/.../PlayGamesModule.kt` — exposes `signInSilently`,
  `isAuthenticated`, `unlockAchievement`, `incrementAchievement`, `showAchievements`
  over `com.google.android.gms.games.PlayGames` (v2). Defensive: no current
  Activity → resolves false/no-op, never throws; `PlayGamesSdk.initialize` is
  try/caught (missing APP_ID meta-data must not crash launch). `signInSilently`
  is TRULY silent — it only reads the v2 automatic sign-in result and never
  triggers the interactive prompt (an interactive flow would be a separate,
  user-initiated method).
- `modules/play-games/expo-module.config.json` + `android/build.gradle` — autolinked
  automatically (Expo scans `./modules`); verified via `expo-modules-autolinking`.
- `utils/playGames.ts → resolveNativeModule()` now resolves it via
  `requireNativeModule("PlayGames")`; still a clean no-op on iOS / web / Expo Go.

**Verified here:** TypeScript, tests, autolinking discovery of the module.
**NOT verifiable from the repo sandbox:** the Kotlin actually compiling against the
v2 SDK and the Gradle build succeeding — that's what the internal/dev build proves.
If the native build fails it'll be in `:play-games:compileDebugKotlin` or the
Gradle config — grab that log and it's a quick fix.

Remaining before achievements actually appear in Play Games:
- Fill the `CgkI…` ids in `data/playGamesAchievements.ts` (Step 3). Until a row has
  an id it won't be pushed, even though the bridge now exists.
- Run a dev/internal build on a device with a Play Games test account and confirm
  an unlock shows the Play Games toast + `showPlayGamesAchievements()` opens the
  overlay.

## Step 6 — Verify (never Expo Go)

PGS cannot run in Expo Go. Verify on a real device / emulator with Play Store:

```bash
eas build --profile development --platform android
# install the dev client, sign in with a Play Games test account
```

Check: silent sign-in succeeds, unlocking an achievement in-app shows the Play
Games toast, and `showPlayGamesAchievements()` opens the native overlay. Add your
account under Play Games Services → **Testers** first, or sign-in is blocked until
the PGS config is published.

## Sidekick (separate, config-only)

Sidekick (the Level Up overlay: screenshots, screen record, streaks) needs **no
code** — enable it in Play Console (Testing → Advanced settings → Play Games
Sidekick, "on by default") on the 1.3.0 AAB and complete the Sidekick SDK
registration form (~1–2 week approval). Achievements *inside* Sidekick require the
PGS Achievements integration above. Prereqs already met: minSdk 24 (≥23), release
is an AAB.
