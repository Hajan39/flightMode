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
| `plugins/withPlayGames.js` | Expo config plugin that injects the PGS app-id manifest metadata. |
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

## Step 4 — Wire the app id into the build

In `app.json`:

```jsonc
"plugins": [ /* ...existing... */, "./plugins/withPlayGames" ],
"extra": {
  "playGamesAppId": "1234567890",   // the numeric id from Step 1
  // ...existing extra...
}
```

Until `playGamesAppId` is set the plugin is a no-op, so add it in the same change
as the id. **This touches `app.json` + `plugins/`, which the `release-main`
`decide` job routes to a full native build (correct — PGS needs one).**

## Step 5 — The native module (the real remaining engineering)

The wrapper resolves its native module in `utils/playGames.ts → resolveNativeModule()`,
currently by `require("react-native-google-play-game-services")`.

⚠️ That community lib is **unmaintained, RN-0.40-era, and has no New Architecture /
Fabric support** — FlightMode runs the New Architecture (Expo SDK 56 default), so
adding it as-is risks breaking the EAS build. Pick one:

- **Preferred:** write a small custom Expo native module (Kotlin) wrapping the
  official **Play Games Services v2** SDK (`com.google.android.gms:play-services-games-v2`),
  exposing `signInSilently`, `unlockAchievement`, `showAchievements`. Then point
  `resolveNativeModule()` at it.
- **Or:** vet a maintained third-party package that supports New Arch, and adapt
  `NativePlayGames` / `resolveNativeModule()` to its API surface.

The wrapper's `NativePlayGames` type documents exactly the methods needed — keep
the adapter to that one function so nothing else in the app changes.

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
