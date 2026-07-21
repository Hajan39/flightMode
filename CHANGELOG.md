# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]

### Removed

- Removed the `tap-rush` game — pure fast-tapping with no targeting, a strict subset of Whack-a-Mole, so it was a redundant duplicate. Dropped its game module, registry entry, the `tap-champion` achievement, and its now-unused translation keys (across all 12 locales; the shared `tapRushScore` key is retained — Higher or Lower reuses it). Catalog is now 33 games. No other games were cut — the rest are distinct mechanics we're keeping.

### Changed (UX review — wave B)

- Home decluttered: removed the "Quick Actions" row (it duplicated the bottom tab bar) and promoted the Daily Flight Challenge to directly under the flight card, so the core retention hook is near the top instead of buried mid-scroll.
- Accessibility: the shared Game controls now expose localized Resume/Pause/Restart labels (were hardcoded English) across all 12 languages, and the Home flight-card close button gained a larger touch target (hitSlop) and a localized "Clear flight" label.
- Dark-theme contrast: added a per-theme `onTint` foreground token (dark uses a near-black navy on its pale-blue tint) and adopted it for every primary button and active filter/category/preference chip across Onboarding, Flight setup, Relax, Games, Explore, and Home. Previously white text sat on the light dark-theme tint (~1.6:1, well below WCAG); it's now high-contrast in all three themes.

### Fixed (code/UX review — wave A)

- Relax: the breathing exercise buzzed the haptic every second instead of once per phase (an unstable `useHaptic` value in the effect deps combined with the per-second re-render); it now pulses once per phase transition.
- Content: `useContentItems` now merges the optional remote sync cache over the bundled articles by id (remote overrides/adds, bundled preserved) instead of replacing the whole set — a partial remote response can no longer make offline articles disappear. Matches the documented contract.
- Flight setup: the duration minute stepper now carries/borrows into the hours field (2h 00m − 5m → 1h 55m) instead of wrapping minutes in place.
- Android: removed the unused `RECORD_AUDIO` permission and added it to `blockedPermissions` (the app only plays audio, never records).
- Settings: support-email subjects said "EON …" (stale template brand) — corrected to "FlightMode …". (Note: `SUPPORT_EMAIL` still points at `support@eon-app.com` and needs the real FlightMode address.)
- Repo hygiene: removed a stray committed `tsc-errors.txt` artifact and git-ignored it; refreshed CLAUDE.md (documented the discovery/image-cache stores and destinations/preflight routes, corrected the cabin-call description, cleared a resolved known-debt note).

### Added

- Tests: extracted Minesweeper's pure board logic to `games/minesweeper/logic.ts` (mine placement with a first-tap-safe guarantee + injectable RNG, adjacency counts, flood reveal, win check, flag count) and unit-tested it across seeds (exact mine count, first tap and neighbours always safe, adjacency correctness, flood never reveals a mine, all-empty flood → win). Test suite is now 279 tests across 13 suites.
- Expanded destinations from 39 to 44 (added Doha, Warsaw, Budapest, San Francisco, Auckland).

- Tests: extracted Snake's pure movement logic to `games/snake/logic.ts` (`step` for move/grow/collision, `placeFood` with an injectable RNG, `opposite`, `getIntervalMs`) and unit-tested it — wall/self collision, growth on eating, speed ramp, food placement never on the snake, board-full → -1. Test suite is now 252 tests across 12 suites.
- Expanded destinations from 34 to 39 (added Lima, Nairobi, Vancouver, Copenhagen, Kuala Lumpur).

- Tests: extracted Sudoku's pure helpers to `games/sudoku/logic.ts` (cell coordinates, peer check, conflict detection, solved check, time format) and unit-tested them; added a bundled-content integrity test (every article in `data/content.json` has a unique id, positive read time, and non-empty en/cs/de title/category/body). Test suite is now 237 tests across 11 suites.
- Expanded destinations from 29 to 34 (added Madrid, Stockholm, Delhi, Osaka, Zurich).

- Added Word Search game (`word-search`): a new genre — find 6 hidden aviation words in an 8×8 letter grid (horizontal, vertical, or diagonal; forwards or backwards). Tap the first and last letter to select. New "Word Hunter" achievement. The grid logic (`games/word-search/logic.ts`) is pure and unit-tested (placement readability across seeds, straight-line detection). Brain/medium/4 min. Fully localized across all 12 languages. (Total games: 34.)
- Tests: extracted the flight-time game recommendation logic to `utils/flightRecommendations.ts` and added unit tests (bucket selection by remaining time, preferred-category ordering, play-together exclusion, limit). Added `useGameStore` tests covering new-best, streak grow/reset, `levelStarsPatch` max-merge, and per-game reset. Wired an AsyncStorage jest mock (`jest.setup.js`) so persisted stores are testable. Suite is now 156 tests.
- Expanded destinations from 19 to 24 (added Bali, Marrakech, Buenos Aires, Prague, Toronto).

- Added Cargo Catch game (`cargo-catch`): a reflex game — slide the loader cart left/right to catch falling cargo (+1 each) and dodge bombs (each costs a life). 3 lives, 60-second wall-clock round, difficulty ramps up. New "Cargo Captain" achievement (catch 25). Reflex/medium/2 min. Fully localized across all 12 languages. (Total games: 33.)
- Tests: added Word Guess logic tests — extracted the pure marking logic to `games/word-guess/logic.ts` and unit-tested green/yellow/gray resolution including double-letter edge cases, plus word-pool integrity (all 5-letter, unique). Also fixed a non-word ("GROUN") in the daily word pool → "PROPS".
- CI: added a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs `npx tsc --noEmit` and `npm test` on every push and pull request.
- Expanded destinations from 14 to 19 (added Seoul, Cairo, Mexico City, Cape Town, Vienna).
- Added Sliding Puzzle game (`sliding-puzzle`): the classic 4×4 15-puzzle — tap a tile next to the empty space to slide it, arrange 1–15 to solve. Guaranteed-solvable shuffle (random valid slides from solved), move + wall-clock timer, pause support, 3-2-1 countdown. Scoring rewards fewer moves and less time. New "Slide Master" achievement. Brain/medium/5 min. Fully localized across all 12 languages. (Total games: 32.)
- Test suite: introduced Jest (`jest-expo`) with `npm test` and 123 pure-logic/data tests in `__tests__/` — locale key parity across all 12 languages (no missing/extra/empty keys), game-registry integrity (every game's title/description/rules keys exist, valid metadata), achievement integrity, destinations integrity, and Sudoku puzzle validity (all 15 solutions are valid grids with matching clues). Sudoku puzzles were extracted to `games/sudoku/puzzles.ts` to make them testable.
- Expanded destinations from 8 to 14 (added London, Singapore, Istanbul, Sydney, Lisbon, Reykjavík), each with 5 practical tips.
- Flight ↔ destination link: the flight setup form now has an optional destination picker (the 8 bundled destinations). When set, Home's destination card becomes "Tips for {city}" and deep-links straight into that destination's tips (auto-expanded via a `focus` param). Ties the flight tracker and destination tips into one per-flight flow. New keys localized across all 12 languages.
- Destinations & airport tips (`app/destinations.tsx`, `data/destinations.ts`): a browsable screen of practical tips (airport-to-city transport, getting around, food, money, local etiquette) for 8 popular destinations, reachable from a "Where you're headed" card on Home. Bundled offline content (English). Screen chrome localized across all 12 languages.
- Home "New to try" row: surfaces games you haven't opened yet (up to 4) so each flight has something fresh — a better fit than daily streaks for occasional use. Games drop out once opened (tracked in a new `useDiscoveryStore`). Localized in all 12 languages.
- Onboarding personalization: a new "What do you enjoy?" step lets users pick preferred game categories (Logic/Speed/Strategy/Multiplayer, skippable). The choice biases the "Games for your flight" recommendations toward those categories. Stored in settings; localized in all 12 languages.
- Pre-flight readiness screen (`app/preflight.tsx`): a modal reachable from a "Ready to fly?" button in the Home flight section. Confirms that games, articles, and relax mode are all available offline (with live counts), shows current network status, and — when online — offers a one-tap "Download latest content" to refresh the optional remote content cache before going offline. Directly serves the offline-companion north star. Fully localized (13 keys × 12 languages).
- Home: added a "Games for your flight" row (shown only when a flight is set) that recommends solo games sized to the time left — quick games (≤3 min) for short hops, mid-length for medium flights, and deep/hard games for long hauls. No backend; derived from each game's estimated time and difficulty. Fully localized across all 12 languages.
- Home: added a "Jump back in" row that surfaces your most recently played games (newest first, up to 4) for one-tap resume, showing each game's best score. Hidden for brand-new users with no play history. Fully localized across all 12 languages.

- Added Cabin Lights game (`cabin-lights`): Lights Out puzzle — tap a cabin light to toggle it and its neighbors, turn everything off to clear the round. 5 rounds with boards growing from 3×3 to 5×5; scrambles are generated from random taps so every puzzle is solvable. Scoring: 100 per round + move-efficiency bonus. Brain/medium/5 min. Fully translated across all 12 supported locales.

### Changed

- Reframed progress around flights instead of daily streaks, matching the app's bursty, per-flight usage (you fly occasionally, not daily). Home and Profile now headline "Flights" (and Profile shows "Games Tried") instead of a "Day Streak" that would almost always read 0–1. The two former daily-streak achievements were repurposed to reward returning for more flights — "Round Trip" (2nd flight, the key retention moment) and "Seasoned Flyer" (5 flights) — instead of near-impossible 7-consecutive-day goals.
- Accessibility & theming polish: the 2048 and Snake D-pad direction buttons now expose localized accessibility labels (all 12 languages) instead of hardcoded English. Added semantic `danger` / `dangerSurface` / `dangerBorder` theme tokens and adopted them for wrong-answer surfaces (Quiz, Sky Math, Odd One Out, Reaction) and low-time timers (Tap Rush, Whack-a-Mole, Cabin Call, Emoji Find) — these previously used fixed dark-red hex that looked wrong on the light theme.
- Removed dead `subtitle` prop in the 2048 result overlay.

### Fixed

- Whack-a-Mole: pausing did not stop the game clock — wall-clock deadlines (round end + mole lifetimes) are now shifted by the pause duration on resume, so paused time no longer counts against the round.
- Air Traffic Control & 2048: game-over could fire `updateProgress()` twice for a single game (two end conditions racing in the same tick), inflating `timesPlayed` and streaks — both now guard with a synchronous game-over flag.
- Extended the double-`updateProgress` fix to 7 more games found in an audit (runway-landing, flight-path, sky-defense, sky-math, quiz, word-guess, sudoku): each could double-record a single game via a stale-state guard, a game-loop tick landing before interval cleanup, or side effects run inside a setState updater — all now use a synchronous guard / call updateProgress outside updaters.
- Stack Sort: undo incremented the move counter instead of cancelling the undone move, inflating the star penalty — now decrements.
- Fixed setTimeout leaks (setState-on-unmounted risk) in reaction, memory, sky-math, quiz, and cross-air-radar — timers are tracked in refs and cleared on unmount/restart.
- Localization: Sudoku difficulty time hints ("~10/20/30 min") and the Word Scramble in-round score pill (mislabeled "BEST") now use localized keys across all 12 languages.
- Sky Defense: placing a tower could land it on the wrong cell when tapping over an on-board element (enemy, existing tower, grid line) — placement used the tap's element-relative coordinates. Now derived from the board's measured window position and the touch's absolute coordinates, so towers land exactly where tapped.
- Cross Air Radar: "sunk ship" message showed hardcoded Czech text ("sestreleno") in all 12 languages — replaced with the localized `arShipDown` key.
- Connect 4 & Hangman: enlarged effective touch targets (column drop buttons ~18px, keyboard keys ~34px) via `hitSlop` to meet the 44px minimum without changing layout.
- Notifications: `expo-notifications` is now loaded lazily and skipped entirely in Expo Go (SDK 53+ removed push support there), removing the startup error; dev/production builds unaffected.

- Stability: added a custom root error boundary plus a global JS error handler. Uncaught errors are now logged to Android logcat (visible in the Play Console pre-launch report) and to analytics (`app_error`, technical fields only), and the user sees a recoverable "Something went wrong / Try again" screen instead of a silent crash.
- Stability: each startup bootstrap (analytics, network, notifications, content sync, image sync) and the achievement toast is now isolated in its own error boundary — a failure in one non-critical subsystem is logged (with the subsystem name) and skipped instead of crashing app startup.

- Added Word Guess game (`word-guess`): Wordle-style 5-letter word game — guess the hidden word in 6 tries, with green/yellow/gray tile feedback and a full QWERTY keyboard. Daily word picked from an aviation + common-word pool. Scoring: 1000 − attempt×150. Brain/medium/4 min, daily challenge eligible.
- Added Sudoku game (`sudoku`): classic 9×9 number puzzle with 15 pre-verified puzzles across easy/medium/hard difficulties. Cell highlighting, conflict detection in red, 3 hints per game, wall-clock timer, and pause support. Scoring: max(500, 5000 − elapsed×8 − hints×200). Brain/hard/12 min.
- Added Snake game (`snake`): 18×18 grid — steer the snake with a D-pad, eat food to grow, avoid walls and your own tail. Speed increases with score. Reflex/medium/5 min.
- Added 5 new achievements: Word Solver (first Word Guess win), Word Master (win in ≤3 attempts), Sudoku Novice (first Sudoku win), Sudoku Master (hard difficulty, no hints), Snake Charmer (score ≥ 20 in Snake).
- UX: Achievement badges on Profile screen enlarged to 2-column layout with title and description — badges were previously too small to read.
- UX: Home screen hardcoded colors (`#f0f8ff`, `#ddd`, `#666`, `#999`) replaced with theme tokens — fixes broken appearance in dark and crazy themes.
- UX: Games screen empty state is now filter-aware — shows a different message and a "Clear filters" button when filters are active and no games match.
- UX: Flight edit day stepper now uses Ionicons chevron icons instead of text arrows, with back/forward buttons disabled when at the date boundary (today / +14 days).
- UX: Relax screen shows a thin progress bar below the sleep timer countdown so users can see how much time is left at a glance.
- All 3 new games and all new achievements fully translated across all 12 supported locales.

- Added 2048 game (`twenty-forty-eight`): classic sliding-tile puzzle — slide tiles in 4 directions, merge equal tiles, reach 2048. Score = sum of merged tile values. D-pad controls, pause support, full GameResult with best/streak tracking.
- Added Minesweeper game: 9×9 grid, 10 mines — tap to reveal, long-press to flag. First tap always safe (mines generated after). Flood-fill reveal for empty cells. Score = 1000 − elapsed×5 on win, 0 on loss. Wall-clock timer.
- Added Word Scramble game (`word-scramble`): 12 rounds, 30 seconds each — tap scrambled aviation-word letters in correct order to spell the word. 10 pts per word + up to 5 speed bonus. 3 skips per game. Pause support. Daily challenge eligible.
- All 3 new games fully translated across all 12 supported locales.
- Added skill achievements for hard strategy games: Sky Guardian (score 100+ in Sky Defense), Sky Commander (score 500+ in Sky Defense), Tower Operator (score 150+ in Air Traffic Control), Air Boss (score 500+ in Air Traffic Control). All 4 achievements translated across all 12 supported locales.
- Added Color Clash game (Stroop test): 20-round brain game where a color word appears in random ink — tap only when word and color match. Animated progress bar, feedback flash, haptics.
- Added Simon Says game: classic memory sequence — 4 colored buttons flash in growing order, repeat exactly with 3 lives. Score = longest sequence completed.
- Added Whack-a-Mole game: 3×3 grid, 30-second wall-clock timer, tap moles before they vanish. Speed and mole count increase over time.
- Added Higher or Lower game: 10-round reflex game predicting whether the next number (1–12) is higher or lower. Instant feedback, haptics, streak tracking.
- Added Odd One Out game: 15-round visual puzzle — find the one emoji that doesn't belong in the grid. Grid grows from 3×3 to 5×4, time shrinks each round.
- Redesigned flight setup form: date chips (Today / Tomorrow / +2 days) + day stepper replace free-text date input; hour/minute steppers replace free-text time input; optional flight number field added. No native dependency added — fully OTA-safe.
- Added timezone label below departure time stepper so users know which timezone is being used.
- Added pause (GamePauseOverlay) to Flight Quiz and Sky Math games — both now support resume / restart / quit via pause menu.
- Added welcome card on Home screen for first-time users (0 games played) pointing them to the games list.
- Added `achievement_unlocked` analytics event fired for every achievement as it unlocks.

### Changed

- Simplified GameRules emoji-header regex from verbose Unicode-range pattern to `/^\p{Extended_Pictographic}/u` — functionally equivalent, no lint warning.
- Flight number is now saved with the flight when entered and displayed on the Home flight card (it was an unused field in the type before).
- Removed stale known-debt items from CLAUDE.md: departureTime reset (already fixed), GameRules regex (now fixed), estimated-minutes mapping in useProfileStats (already complete).

### Added

- Added Color Clash (Stroop test) game: 20 rounds, 1.8 s per round, animated progress bar, correct-tap/skip scoring, feedback flash, full haptic feedback, and GameResult overlay. Registered as a brain/medium daily-challenge game. Translation keys added across all 12 supported locales.
- Added analytics opt-out toggle in Settings under a new Privacy section. Users can disable anonymous usage statistics at any time; the preference is persisted across sessions. Available in all 12 supported languages.
- Expanded all 44 bundled articles in `data/content.json` from 56–237 words to 350–415 words each (EN), with equivalent expansions in Czech and German. All articles now include structured sections (must-see spots, food tips, getting around, practical tips, day trips) for a richer offline reading experience.

### Changed

- `AnalyticsProvider` now reads `analyticsEnabled` from the settings store and immediately disables or re-enables the PostHog sink when the user changes the preference — no app restart required.

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
- Added retention-oriented analytics events: `second_session_started`, `first_session_completed`, and `flight_setup_completed`.
- Added local-notification foundation with `expo-notifications`, Android channel bootstrap, reminder scheduling after flight setup, and reminder open tracking.
- Added a subtle support CTA in Settings that links to Buy Me a Coffee using supporter-oriented copy (`Become a supporter`) and supporting helper text.
- Added support-funnel analytics events: `support_opened`, `support_clicked`, and `support_completed`.

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
- Expanded `app_open` event payload with `app_open_count` and `is_returning_user` to support D1/D7 retention analysis.
- Flight setup now supports planning departure date and time, instead of always defaulting departure to immediate `now`.
- Local reminder scheduling now targets planned departure (`-3h` preferred, then `-30m`, else `+5m` fallback).

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
