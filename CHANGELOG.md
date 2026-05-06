# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Added a unified game UX system: animated `GameResult` with Best / Last / Streak chips and a "New Best!" badge, shared `GameControls` (pause + reset icon row), `GamePauseOverlay`, and a 3-2-1 `GameCountdown` overlay with haptic ticks.
- Added `lastScore`, `currentStreak`, and `bestStreak` fields to per-game progress, with a backwards-compatible persisted-store migration.
- Added shared game UX translations (`gameBest`, `gameLast`, `gameStreak`, `gameNewBest`, `gamePause`, `gameResume`, `gamePaused`, `gameRestart`, `gameQuit`, `gameReady`, `gameGo`, `gameTapToStart`) across all 12 supported locales.
- Added a guarded PostHog analytics foundation for anonymous product events.
- Added first analytics events for app open, onboarding, flight setup, games, articles, relax, and ambient audio.
- Added an Expo Network foundation for online/offline status and anonymous connectivity-change analytics.
- Added an article sync foundation with optional remote endpoint caching and bundled-content fallback.
- Added an article sync network preference for Wi-Fi only, Wi-Fi plus mobile data, or off.
- Added anonymous analytics coverage for Settings, Profile, Home quick actions, Home article recommendations, and Explore discovery controls.
- Added intent-based Games filters for quick, play-together, and longer sessions.

### Changed

- Refactored Reaction, Tap Rush, Sky Math, Cabin Call, Runway Landing, Memory, Quiz, Sky Defense, Air Traffic Control, and Flight Path to use the shared game UX system: visible "Best" pill in-game, a 3-2-1 countdown before timed rounds (Tap Rush), pause + restart overlays where it matters, consistent reset button, and the new result screen showing Best / Previous / Streak with a "New Best!" celebration when triggered.
- Reframed product documentation around FlightMode as an offline travel assistant plus entertainment system.
- Compactly grouped Settings into app preferences, article sync, and support sections as the screen grows.
- Kept Strapi scope explicit: remote sync is for articles only, while the rest of the app remains local-first.
- Made article sync tolerate a Strapi root URL and empty public Articles responses while keeping bundled article fallback.
- Documented the Strapi Article field contract and validation path for a later content-sync slice.
- Shifted the active product focus toward game quality, replayability, difficulty calibration, and analytics consent UX.
- Calibrated the first set of game metadata and daily challenge eligibility around shorter, more replayable sessions.
- Highlighted daily challenge and play-together games directly on Games cards.
- Reduced Games card color noise so filters carry the main accent and metadata stays quieter.
- Added multiplayer play-mode metadata so shared-screen and pass-and-play games are labeled consistently in Home and Games discovery.
- Reworked Tic Tac Toe Duo with selectable 3x3 classic and 5+ growing-board modes up to 30x30.
- Updated privacy documentation for anonymous product analytics and future online sync behavior.

### Added

- Added card flip animation to Memory (Pexeso): cards now snap through a 260ms rotateY transition when revealed or hidden, making the game feel tactile and alive.
- Added haptic feedback throughout the Relax screen: breathing start/stop, every breathing phase transition (subtle metronome pulse), soundscape selection, volume chips, and sleep timer chips.
- Added haptic feedback to onboarding: tap on each page advance, success burst on "Get Started" / skip.

### Changed

- GameResult overlay now fades in after a 300ms delay and the score bounce + haptic fire at 450ms, giving players a moment to see their final move before the result screen appears.
- Daily Challenge card on Home now uses the brand accent background and border with a left accent bar to make it visually the primary CTA on the screen.
- Home screen sections now have consistent vertical spacing (marginTop 20) so content no longer runs together as one dense block.

### Fixed

- Fixed Android search input centering in Games tab (removed conflicting `height: 22` from inner TextInput).
- Fixed potential flash on dark/crazy themes when entering a game screen (SafeAreaView now inherits `theme.background`).
- GameComponent in game screen is now memoized by game ID to avoid redundant `require()` calls on re-renders.
- Reaction now passes previous session score as the `last` stat in the result screen so players can track session-over-session progress.

- Repaired mojibake and broken symbols across cross-device game UIs and compact article content.
- Completed UI translation key coverage across all supported app languages.
- Fixed Reaction Timer progress so one completed session records one play and shows a result overlay.
- Fixed Tap Rush so the round timer now follows real elapsed time even during extremely rapid tapping.
- Improved Tap Rush tap registration so very rapid tapping is counted more reliably.
- Fixed Cabin Call, Emoji Find, and Air Traffic Control timers so rapid tapping no longer delays countdown/fuel depletion; timed gameplay now uses wall-clock deadlines consistently.
- Fixed Games and Explore top filter chips so the header filter rows no longer visually overlap.
- Moved Sky Defense next-wave info into a centered overlay so clearing a wave no longer shifts the whole screen.
- Added a restart confirmation step to Sky Defense so accidental reset taps do not immediately wipe the current run.
- Fixed Sky Defense tower placement preview so selected defenses show their range while aiming placement on the board.
- Added saved per-level stars to Stack Sort level select and migrated old encoded results into the new level-star history.
- Fixed Reaction so result modal now shows fastest reaction time in milliseconds instead of internal score points.
- Added difficulty selector to Sky Math (Easy/Medium/Hard) with difficulty-aware question generation.
- Updated Flight Path with 2-second incoming spawn telegraphs and strict plane-type-to-runway matching with color-coded runway acceptance hints.
- Updated Duel Hangman setup to allow 1-player runs and adjusted word rendering to keep single-word guesses on one line (horizontal overflow instead of wrapping).
- Improved Air Radar battle feedback: when a full enemy plane is destroyed, the game now announces which plane was shot down and shows remaining hits/planes to finish the round.
- Removed score bounce animation from Memory (Pexeso) result screen for calmer finish feedback.
- Fixed the Dice Duel final scoreboard so multi-player results are scrollable, ranked, and no longer clipped on smaller screens.
- Improved the Dice Duel in-round score strip so each player card shows the current roll more clearly with less visual clutter.
- Improved Air Radar setup so placed fleet pieces can be selected, dragged, and moved before confirming readiness.


## [1.0.0] - 2026-04-23

### Added

- In-screen search for Games.
- Complete `cs/de` translations for previously English-only entries in `data/content.json`.
- Two canonical operational docs:
  - `documents/app-status-and-changelog.md`
  - `documents/todo-and-improvements.md`

### Changed

- Centralized game metadata into `data/games.ts` and wired it across Games, Game Detail, Home, Profile, and profile stats.
- Applied microcopy polish across Home, Games, Explore, Relax, Profile, Settings, and detail screens.
- Simplified Games and Explore top sections by removing redundant in-screen titles in favor of the navigation header.
- Simplified Games discovery with lighter category filters.
- Prevented mixed-language content display by showing language-ready content for non-English locales in Home and Explore.

### Fixed

- Android text clipping in Games search and filter controls.
- Stabilized Home layout and clarified flight utility placement.
- Improved onboarding and game-result microcopy consistency in EN/CS.
- Flight edit semantics to avoid unintended timeline reset behavior.
