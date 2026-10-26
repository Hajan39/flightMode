# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]

### Fixed

- **Review round 6:** Flight Path planes appear again (only the incoming warnings showed, no plane ever spawned). Home's remaining flight time and tip keep updating during the flight. Word Guess no longer leaves a dead board after tapping Reset right after a guess. Result screens, the 3-2-1 countdown and several timed games no longer re-buzz or restart their timers on every screen update; the countdown also finishes when the game updates behind it. Leaving the app pauses only once (Sudoku and Sliding Puzzle no longer count paused time twice; Cabin Call keeps its remaining time). Quiz and Sky Math no longer move to the next question behind the pause screen. Whack-a-Mole no longer spawns two moles at once. Color Clash shows the same score it saves (never below 0). Code Breaker plays a number of rounds that lets every player guess first equally often (2 players: 4 rounds). Duel Dice best scores from the old scoring are reset (games played and streaks stay). If saved data could not be read, changes made during that session are no longer silently undone by the background re-read; a tip bought then is still completed with Google Play instead of being refunded. Opening an article is reported once even if articles finish syncing meanwhile.
- **Review round 5 — multiplayer games that could not finish:** Duel Dice (the die never settled), Duel Emoji Find (the turn never ended, the target never changed) and Split Duel (stuck on the countdown; later rounds used stale state and a tie wiped the score) — a timer cleanup ran after every render and cancelled the game's own timers. Fixed in these and two more games; render tests under the default Jest config guard it.
- **Review round 5 — scoring and fairness:** Runway Landing no longer scores the same round again on repeated taps; Sky Defense pays a kill reward once; Duel Dice ranks by round wins (pips only break ties) and its rules describe the real game; Quiz / Sky Math / Cabin Call / Memory use an unbiased shuffle (the Quiz answer sat on B or C 77 % of the time); Cargo Catch counts a win only when you survive; Color Clash has 10 matches + 10 mismatches and penalises wrong answers, so idling no longer scores; Code Breaker shows empty slots and rotates the first guesser; Connect 4 alternates the opener after a draw; Simon Says lives no longer go negative.
- **Review round 4 — saved data:** synced articles could be wiped on the phone when the app launched on Wi-Fi and was closed before the download finished (sync started before saved data had loaded, and then re-downloaded the 2.5 MB feed on every launch). Every saved store now refuses to write until its data has loaded, keeps a `.corrupt` backup of unreadable data and never overwrites it with defaults; file writes are atomic. Article and rate syncs wait for saved settings (so "Online Sync: Off" holds at launch) and honour their cooldowns. iPhone article images survive app updates. Profile no longer counts removed achievements/games ("58/57").
- **Review round 4 — flights and screens:** a saved flight can be edited (tap the card); clearing an upcoming or active flight asks first; Home returns to "Add your flight" 48 h after landing; a double tap on save no longer logs two flights; a future flight shows "Departs in …". Checklist ticks made before adding a flight are kept and checklist achievements can't be farmed by resetting. Breathing stops when leaving Relax. Deep-linked destinations and phrasebook languages scroll into view. The converter takes negative temperatures and defaults to USD for an unknown device currency. Double taps no longer open a screen twice. Plus shows progress, pending payments and an offline hint. Bug-report links show the address when no mail app exists. Correct plurals (incl. Czech/Polish). Unknown article links no longer count as read.
- **Review round 4 — follow-up fixes:** a store whose saved data could not be read now retries with backoff (100 / 400 / 1000 ms), re-reads once in the background and saves normally again once a read succeeds (anonymous `storage_read_blocked` event, store name only). Plus and tips bought or restored while saved data is still loading are no longer lost (a tip is consumed only once it can be counted). A half-written first save is no longer promoted over older data. Games also auto-pause on iPhone when sent to the background from the app switcher. A trip past its 48 h landed window no longer adds "For {city}" checklist items, and resetting the checklist after clearing the flight can't count the completion achievement twice. Flight Path no longer drops a just-grabbed plane's new path.
- **Review round 4 — games:** timed games pause automatically when you leave the app (tilt balance and minesweeper gained a pause; a reaction attempt is cancelled), and several pause timers were made exact. TalkBack can no longer read a hidden board under the pass-the-phone and pause screens. Solitaire, Mahjong, Sky Match and Cargo Blocks are playable with a screen reader (Cargo Blocks also by tap: select a piece, tap a cell). Board text no longer overflows cells with large system fonts. Box Breaker, Snake and Flight Path redraw much less.

### Fixed (round 3)

- **Review round 3 — regressions from earlier fixes:** anonymous analytics held while offline (or before the network is allowed) is now saved on the device (up to 500 events) with its original time, instead of being lost on restart. The converter reads numbers by app language again: in Czech/German/… "1,250" is 1.25, in English 1250. Good Host / Undefeated Host progress from before round 2 counts again. The article feed waits 8 s for the server and up to 45 s for the download, and skips the download when nothing changed (ETag / 304). Startup no longer waits forever when saved data cannot be read. Stopping a sound no longer cancels the running sleep timer. The crash screen loads safely even if translations fail.
- **Review round 3 — time zones:** the day streak survives crossing the date line; the jet-lag plan wraps shifts over 12 h (New York → Tokyo is "10 h west" now, not "14 h east"); the in-flight sleep window never starts before take-off or ends after landing; the jet-lag card remembers the home time zone from when the flight was saved; the daily challenge no longer changes at 01:00 on daylight-saving days; Home refreshes flight time only while visible; Passport totals ignore a broken entry and refresh while a flight is under way.
- **Review round 3 — accessibility:** screen reader labels for the header buttons, search fields, flight-edit steppers and day buttons, the landed card actions and page dots; filter chips, sounds and timers report their selected state and are at least 44 dp tall; result, pause and countdown overlays are announced; the Word Guess message no longer gets cut off. French and German wording fixes.

### Changed

- Translations other than English load on first use instead of at startup (faster launch). Three shared components (animated buttons, countdown, match result) are now optimised by the React Compiler.
- Tests: second mutation audit (128 mutants, 65.6 % → 93.75 % killed; all survivors are equivalent), 1342 tests.

### Fixed (earlier rounds)

- **Review round 2 — data integrity:** three Sudoku bank puzzles had more than one solution (a valid alternative fill never won); each now has exactly one (test-enforced for every puzzle and transform), and any complete valid grid also wins. Crowd Favorite no longer unlocks in story-only mode; Good Host / Undefeated Host count only real multiplayer matches (solo and co-op runs excluded). High Scorer now means 13 different games, Slide Master 1500+. Snake can no longer reverse into itself on two quick swipes. The converter accepts thousands separators (1 234,5 / 1,234.5).
- **Review round 2 — privacy:** analytics waits for saved settings and is opted out at the SDK level until allowed (a disabled toggle also clears PostHog's own queue); uploads follow the Online Sync network policy. Flight events send coarse departure/duration buckets instead of exact timestamps; error events send a sanitized code instead of raw messages; route sources are allow-listed. The article feed has an 8 s timeout and rejects captive-portal HTML; article images respect the sync policy, are https-only, size-capped and hash-named.
- **Review round 2 — translations:** achievement descriptions now match their real conditions in all languages; five English-only rule texts translated in 9 languages; German and Portuguese and French register/variant unified (du, Brazilian, tu); Czech/German grammar, plural and capitalisation fixes; neutral rating-prompt wording (Play policy); hard-coded English labels translated; the sync setting is now "Online Sync" and says what it covers.
- **Sudoku could not be won by typing the last digit** (and error marks were wiped): the move result was read from inside a React state updater, which React 19 runs later. Now computed by a tested `applyMove`.
- **Air Traffic Control stopped scoring after the first landing**, and wrong runways cost no miss — same updater pitfall; now a tested `resolveAssignment`.
- **Sleep timer kept soundscapes playing all night with the screen off** (Android pauses JS timers in the background): the deadline is now enforced from the audio player's native status callback and on app resume.
- **Play Games unlocks were lost for the whole session** if the launch sign-in check failed (e.g. offline): sign-in now retries with backoff, on unlock and when the network returns, and re-sends every local unlock after signing in.
- App-open count and day streak could be overwritten by persisted state loading late (rating dialog and second-session event never triggered); both now wait for hydration, and the streak also updates on app resume.
- Deleting a flight now also cancels its flight-ready reminder; no reminder is scheduled for a past or imminent departure.
- Word Scramble: resetting during the answer flash no longer jumps to a mismatched round. Sky Match: the idle hint returns after cascades and leaving mid-cascade no longer records a result. Box Breaker: pausing no longer burns power-up time. Minesweeper / 2048: results and mine placement can no longer be applied twice.
- Tip-jar purchases are counted only after the purchase is consumed (no double counting). Passport stamp durations are translated.
- **Hangman Czech words**: the Czech pool had been flattened to plain A–Z for the keyboard, leaving misspelled words (BEH, PRISTANI, VZDUSNIK) and outright non-words (PLN, OSOV, TYRL). It is now 78 real aviation/travel words in proper spelling (PŘISTÁNÍ, LOĎ, VÍTR…), and the A–Z keyboard reveals accented letters too (R uncovers Ř, E uncovers É and Ě). Tests assert every word in every language is solvable on the keyboard and the old junk stays out. Wordle's Czech pool drops the colloquial VEPŘO and the English-spelled SUSHI.
- **Currency converter offline**: only the 33 curated currencies had an offline rate, so a home or target currency from the full list (e.g. NOK, RON, BGN, PHP) — or a phone region outside the curated table — showed just "–" in airplane mode until live rates had been fetched once. A bundled snapshot of 165 currencies (`data/currencyRatesSnapshot.ts`, 2026-10-25 reference rates) now backs every currency the picker offers; live rates still override it when available. A test asserts every offered currency converts with no network.
- **Tilt steering was mirrored on Android** (tilt left → paddle right) in Box Breaker, Maze Muncher and Turbulence Test: Android reports the reaction to gravity, not the pull, so its axes are now flipped (`gravityTilt` in `games/tilt-balance/logic.ts`).

### Added

- **Two arcade games (catalog 45 → 47)**: **Box Breaker** — Breakout with 12 layouts: 1–3-hit boxes with damage pips, bombs that blast their neighbours (and chain), mystery boxes that always drop a power-up, steel walls that form corridors; moving the paddle as the ball lands puts spin on it and every bounce speeds the ball up a little; power-ups wide paddle, three balls, fireball (burns through boxes) and extra life; hit flash, debris, ball trail and a shake on explosions. **Maze Muncher** — a Pac-Man-style maze with four ghosts that each hunt differently (scatter/chase), power dots that turn them edible (200/400/800/1600) and a side tunnel. Both play with a finger (drag / swipe) or by tilting the phone.
- **Local gates match CI**: `.gitattributes` forces LF (Windows CRLF checkouts failed every Biome format check locally) and `package.json` gains `lint` + `typecheck` scripts. Four weak assertions (`not.toBeNull` / `toBeDefined`) now check exact messages and values.
- **9 achievements for the new games (48 → 57)**, mirrored to Google Play Games: Sky Match (level 10, all 30 levels, 3 stars on 10 levels), Cargo Blocks (500 / 1500 points), Solitaire (a win, 3 wins in a row), Mahjong (a cleared board, 3 in a row). Localized in all 12 languages; Play Console bulk-import ZIP sources (CSV + icons) in `assets/play-store/achievements-v1.6/`.

### Changed

- **Rating prompt you actually see**: Play's in-app review sheet is quota-limited and often never appeared (it fired on the game result screen). FlightMode now asks with its own dialog — Rate (opens the Play listing) / Later / No thanks — on Home only, never during a game, only when online, and only after 4+ app opens and 8+ games played. Later asks again after 30 days; Rate or No thanks never ask again. Localized in all 12 languages.
- **Sky Defense waits for you**: every wave now starts from a build phase — place towers, then tap "Launch wave N". Previously the first wave started the moment you picked a difficulty and the between-wave card covered the board with a 5-second auto-start, so you could not build between waves either.
- **Quiz no longer gives answers away by length**: in 34 of 50 questions the correct answer was the longest option (clearly so in 28). Wrong options were rewritten in all 12 languages to be plausible and of similar length; no correct answer is clearly the longest in any locale now, and two wrong options that were arguably correct were replaced.
- **Word Guess in Czech and German**: the daily word and the keyboard follow the app language — Czech (379 words, QWERTZ + two rows of accented letters) and German (416 words, QWERTZ + Ä Ö Ü); other languages keep the English pool, now 146 → 486 words so the daily word does not repeat within a year. The keyboard no longer overflows the screen edges (Q and P were clipped).
- **Flight progress bar was empty in release builds** (Home flight card): the Reanimated percentage-width fill never rendered; it is a plain percentage view now. Jet-lag advice for 18–04 arrivals says "evening or at night" (a 03:39 arrival was called "evening").
- **New app icon and launch screen**: the icon is an airplane-mode switch turned on (sky-blue gradient, white knob with a plane) with matching adaptive-icon layers and a themed monochrome layer. The launch screen showed the Expo template placeholder (a grey grid) — it now shows the icon on the theme background (white / dark). Play feature graphic (en + cs) and hi-res icon regenerated.
- App version 1.5.1 → 1.5.2 → 1.6.0 (new games) → 1.6.1 (icon and splash) → **1.7.0** (two new games; `package.json` scripts → build lane).

- **Large screens and rotation (Play: "remove resize and orientation restrictions")**: the manifest no longer pins portrait. Phones stay portrait via a runtime lock (`components/OrientationPolicy.tsx`, smallest side < 600 dp); tablets, foldables and desktop windows rotate and resize freely. Every game now renders in a centred portrait column on wide screens (`hooks/useGameDimensions.ts`), so boards no longer overflow on landscape tablets; Memory also fits its grid to the height. Onboarding pages follow window size changes. Turbulence Test maps tilt to screen axes for any display rotation. Verified on 13 screens + all 41 games (start and in-play) at 1280×800 and 800×1280, plus a phone 390×844 regression pass. App version 1.5.0 → **1.5.1** (new native modules: `expo-screen-orientation`, `expo-build-properties`).
- **Release builds are minified and obfuscated (R8) with resource shrinking** (Play: DEX code optimization score — obfuscation was 1 %).

### Added

- **Mahjong (catalog → 45)**: Mahjong solitaire with travel-emoji tiles in three layouts (Island 48, Turtle 84, Jumbo Jet 78); every deal is generated solvable, with hint, shuffle and unlimited undo.
- **New to try on Home lists the newest games first**, so games added by an update show up there instead of the oldest unplayed ones.
- **Three new games (catalog 41 → 44)**: **Sky Match** — match-3 with travel icons, line / bomb / star specials, cascading combos and 30 move-limited levels with 1–3 stars (targets calibrated against a greedy bot in tests); **Cargo Blocks** — drag luggage pieces into an 8×8 hold, full rows and columns clear, combo and streak bonuses; **Solitaire** — Klondike with draw 1 / draw 3, tap-to-move or drag, unlimited undo and auto-complete.
- **Word Search: big osmisměrka mode** — a 10×10 grid packed with travel words whose leftover letters spell a hidden message (Czech, German, English), revealed when you finish. Letters can now be selected by dragging across them as well as by tapping the first and last letter.
- **Google Play Games achievements are live-wired**: all 48 achievements now carry their Play Console ids (`data/playGamesAchievements.ts`), so local unlocks are mirrored to Play Games for signed-in players. A test now fails if any achievement is left without a unique id.
- **Strict linting via Ultracite (Biome)** — `biome.jsonc` extends the strict core + react + jest presets; `npm run check` / `npm run fix`; CI now runs `biome ci` (errors fail the build). The whole codebase was brought to zero lint errors (~4,900 findings resolved: auto-fixes plus manual refactors — nested ternaries, variable shadowing, leaked JSX renders, hoisted regexes, explicit increments). Deliberate deviations are documented inline in `biome.jsonc`; pre-existing debt (hook deps, index keys, complexity hotspots) is tracked as warnings instead of being hidden.
- **App version 1.4.0 → 1.5.0** — `expo-iap` and `expo-store-review` are new native modules; `runtimeVersion` follows the app version, so 1.5.0 OTAs never reach a 1.4.0 binary without them.

- **Soundscapes keep playing with the screen off** — Relax sounds now run in the background with a lock-screen media notification (`setAudioModeAsync({ shouldPlayInBackground })` + `setActiveForLockScreen`), so rain / white noise and the sleep timer work while you sleep on the plane. Uses the media-playback foreground service expo-audio already declares.
- **FlightMode Plus + tip jar (Google Play Billing, `expo-iap`)** — new `app/plus.tsx` (Settings → "FlightMode Plus & tips") replaces the external Buy Me a Coffee link. Plus is a one-time purchase (`flightmode_plus`) that unlocks two new themes (Midnight true-black, Sunset) and a profile badge; three consumable tips (`tip_small`/`tip_medium`/`tip_large`) unlock nothing. Nothing that was free becomes paid. Entitlement is cached in `store/useSupporterStore.ts` (works offline) and restored on launch via `components/BillingBootstrap.tsx`; every billing call is a guarded no-op in Expo Go / web. **Native change → build lane.**
- **In-app review prompt** (`expo-store-review`) — after a new best score, for users with 3+ app opens, at most once per 60 days (`utils/reviewPrompt.ts`). **Native change → build lane.**
- **Sudoku never repeats** — every game is a fresh variant of one of the 15 verified puzzles (digit relabelling, row/column/band/stack permutation, transpose). Validity, the unique solution and the difficulty are preserved by construction, so there's no solver and no new puzzle data.
- **Flight Passport** (Profile) — a stamp for every departed flight (destination emoji, city, date, duration) plus lifetime totals: flights, hours in the air, cities, countries. "Share my passport" sends a short text summary with the Play Store link. Flights are now kept in `useFlightStore.log` after the active flight is cleared (persist v1 seeds it with the currently saved flight); the flight number is never stored there.
- **Live article feed (free, no backend)** — articles now sync from `content/feed.json` served straight from the public GitHub repo (raw.githubusercontent.com). Publishing a guide is a commit to that file; content-only pushes skip the release workflow. Remote items override bundled ones by id and invalid items are dropped; offline the bundled 44 articles remain. Feed ships **365 city guides** (en/cs/de, ~2.5 MB) — every bundled destination plus capitals and a second city across Europe, Africa, the Americas and Caribbean, Asia and Oceania. Replaces the never-configured Sanity client.
- Synced articles are now persisted in a file (`utils/fileStorage.ts`) instead of AsyncStorage, which on Android cannot read values over ~2 MB; existing caches migrate on first launch.
- **City guide button** — a destination card links to its article (`destination-<id>`) when one exists, bundled or synced.
- **Turbulence Test** (catalog 40 → 41) — the app's first motion game: hold the phone flat and keep a ball inside a ring that shrinks while random turbulence gusts push it around. Solo high score or pass-and-play for up to 6. Adds `expo-sensors` (iOS motion permission declared via the config plugin) and degrades to an explanatory screen where no accelerometer exists. New achievement: Steady Hands.
- **Post-landing mode** — for 48 h after arrival Home leads with a "You've landed in {city}" card (destination local time, one-tap phrasebook / converter / arrival tips) followed by the checklist and travel tools; games move below. Driven by `utils/flightPhase.ts` (`none | preflight | inflight | landed`).
- **Jet-lag sleep reminder** — a local notification 10 minutes before the suggested on-plane sleep window, scheduled when the flight is saved and cancelled when it's cleared.
- **Destination-specific checklist items** — 33 cities add a "For {city}" block (IC card, cash-only, ESTA/eTA, modest dress, tap water, mosquito repellent, sunscreen, layers, rain gear, transit card, tipping cash, power adapter); they count toward the progress and the completion achievement.
- **Category Blitz** (catalog 39 → 40) — pass-and-play for 2–6: each player gets a category and 20 seconds to name as many things as possible out loud while the others judge; 40 categories ship as translation keys, so it works in all 12 languages. New achievement: Quick Thinker.
- **Home currency** — a skippable onboarding step and a settings row; the converter starts from it instead of re-deriving the device locale. The currency chips + searchable picker are now one shared `components/CurrencyPicker`.
- **Expo SDK 57 upgrade** (React Native 0.86.3, reanimated 4.5.1, worklets 0.10.1, jest-expo 57, posthog-react-native 4.71, zustand 5.0.15). App version 1.3.0 → **1.4.0** so SDK 57 OTAs land on a fresh runtime. React Compiler now enabled via `app.json` `experiments.reactCompiler` (manual babel plugin removed).
- **Travel tools (offline):**
  - **Travel checklist** (`app/checklist.tsx`) — 5 sections / 27 default items (before departure, documents, carry-on, at arrival, connection) + your own items; ticks reset per new flight, custom items persist. Reachable from Home and the Pre-flight screen.
  - **Destination local time + jet lag** — the Home flight card shows "Now in {city}" and local arrival time (+1 day aware); a jet-lag card gives the hour shift, direction and a concrete on-plane sleep window / stay-awake advice (`utils/timezone.ts`, Intl time zones with bundled-offset fallback).
  - **Phrasebook** (`app/phrasebook.tsx`) — 12 survival phrases in 24 destination languages with romanization for non-Latin scripts; deep-linked from destinations and Home.
  - **Converter** (`app/converter.tsx`) — currency + °C/°F, km/mi, kg/lb. Rates: 33 bundled approximate values as the offline baseline, **refreshed automatically when online** from open.er-api.com (free, no key, ~160 currencies; 12 h cooldown, respects the Wi-Fi/mobile sync policy, persisted in `store/useRatesStore.ts`) with a manual "Update rates now" button and a live/bundled provenance line. Once live rates are present, **all ~166 provider currencies** become available through a searchable "All currencies" picker (English names + symbols bundled in `data/currencyNames.ts`); the 33 bundled ones stay as quick chips.
  - Destinations gain `timezone`, `utcOffsetMinutes`, `phraseLanguage`, `currencyCode`; each destination card links to its phrasebook and currency.
  - 5 traveler achievements: Ready to Fly, Packing Pro, Time Traveler, Polyglot, Currency Savvy.
- **Multiplayer foundation** (`components/multiplayer/`): `PlayerSetup` with persisted player names, `TurnBanner`, `PlayerScoreStrip`, `PassDeviceOverlay` (opaque, "don't peek" mode), `MatchResult` leaderboard with Rematch / Change players / Quit, and a host-based scoring convention (`utils/multiplayerScoring.recordMatch`) so multiplayer best scores and streaks finally mean something.
- **Three new multiplayer games** (catalog 36 → 39): **Split Duel** (shared-screen, simultaneous — phone flat between players, top half rotated, 5 reflex mini-rounds), **Seat Neighbor** (2-player icebreaker: mind-meld + would-you-rather, shared Sync score with tiers, 60 questions), **Turbulence Tales** (2–6 players build an emoji travel story in 3 acts and vote for the best twist; story-only mode). 7 new achievements incl. cross-game Good Host / Undefeated Host.
- Articles missing the active UI language now fall back to English with an `EN` badge instead of disappearing (9 of 12 languages previously saw an empty Explore tab).

### Changed

- **Home refactor** — the 1000-line `app/(tabs)/index.tsx` is now a ~315-line orchestrator plus `components/home/*`; the three near-identical horizontal game rows share one `GameCardRow`. No UX change.
- Seat Neighbor's 60-question bank is now translated into all 12 languages (previously en/cs/de with an English fallback).
- The 14 Travel Tips and Health articles are translated into es/fr/it/pl/pt (8 languages total); the remaining 30 still fall back to English with the EN badge.
- All 8 existing multiplayer games migrated to the shared multiplayer components and design tokens: player names, consistent setup → play → leaderboard flow, match options only in setup (no more silent match reset), draw haptics, translated accessibility labels, tap-to-skip turn delays, connect4 winner check memoized, emoji-find pause + timer cleanup, liars-dice secret hand-off before every peek.
- Destination tip labels are localized (`labelKey`), tip text remains English.
- Removed 71 dead or duplicated multiplayer translation keys from all 12 locales.

### Fixed

- **Device QA of all 41 games (Samsung, release build)**: Simon Says showed no pads (percentage width + aspect ratio collapsed to zero height); 2048 and Snake now take swipes on the board, not just the D-pad; Cabin Call starts with a 3-2-1 countdown instead of running the clock on open; Air Traffic Control gives levels 1–2 three extra seconds of fuel (first-time players lost before reading the board); Stack Sort sizes columns for the level instead of a tiny strip; Minesweeper open cells are visibly different from covered ones; Flight Path no longer piles unreadable runway labels in the centre; Word Search and Word Scramble use Czech and German words in those languages; option chips in player setup are vertically centred.
- Relax: sounds are listed right under the section title (they sat below volume and timer), and the default volume matches a volume chip.
- Profile: stat and achievement grids fill the full width.
- Quiz: the ETA question gave itself away in 6 languages (distractors were left in English).
- Czech: informal "ty" for a single player throughout (rules, achievements, hints), gender-neutral phrasing, Czech names for the games still titled in English, city names no longer forced into wrong grammatical case.
- Returning users could be sent back to onboarding when settings loaded after fonts: the redirect ran on the store's default `isFirstLaunch: true`. It now waits for persisted settings to hydrate.
- Web build crashed on every screen (`baseScheme is not a function`): the web `useColorScheme` variant lacked the helpers added for Plus themes. Shared scheme helpers now live in `components/colorSchemes.ts`.
- German achievement names: "Frequent Flyer" and "Seasoned Flyer" were both "Vielflieger", which Play Console rejects on import (names must be unique per locale). "Seasoned Flyer" is now "Erfahrener Flieger", and the achievements exporter checks name uniqueness in every locale, not just English.
- **Plus analytics inflated on every launch**: restoring purchases at startup re-reported `support_completed` for every Plus owner on every app start (and re-acknowledged the already-acknowledged purchase). Restores now re-grant entitlements silently; only real checkouts report.
- **Play Console achievements export produced empty CSVs**: its parser depended on the key order in `data/achievements.ts`, which the formatter now sorts. It now reads keys order-independently and fails loudly if the parsed count doesn't match or the 1000-point cap is exceeded (`scripts/export-pgs-achievements.mjs`).
- **OTA publish script crashed on start** (`scripts/eas-update-from-changelog`): it mixed `require()` with `import.meta.dirname`, so Node parsed it as ESM and failed on line 1, breaking the release OTA lane. Converted to ESM (`.mjs`).
- **App froze on Wi-Fi (100 % JS CPU, ~1 GB RAM)**: `ImageSyncBootstrap` re-ran after every downloaded article image and shared one cancel flag across runs, so download loops piled up and failed images were retried forever. Now one loop per change, the cache is read imperatively and failed URLs wait for the next launch.
- Content and rates sync retried in a tight loop after a failed request (the bootstrap re-runs on every status change); a failure now backs off for 5 minutes.
- **Articles showed raw markdown** (`**Heading**`, `- **Name** —`): the article screen now renders headings, bullets and inline bold, and keeps the last paragraph above the navigation bar.
- Onboarding: on Android the dots and the Next/Get started button lagged one page behind (late `onMomentumScrollEnd` for programmatic scroll).
- Currency chips (onboarding, settings, converter) always show the selected currency first instead of off-screen.
- **Sudoku grid broke on some screen widths** (the 9th column wrapped because the outer border was not counted in the width) and had no right/bottom outer border; the hint button showed a raw `{{count}}` placeholder.
- Flight screen: the Start button no longer sits under the navigation bar; the title says "Add flight" for a new flight. Passport stamps are no longer clipped.
- Czech copy: unified informal address in onboarding, Passport, Plus and a few game strings.

- Settings: bug-report / feature-suggestion mails went to the template placeholder `support@eon-app.com`; they now go to `flightmode.app@proton.me` (also the privacy-policy contact).
- Android: blocked the unused `ACTIVITY_RECOGNITION` permission that `expo-sensors` merges into the manifest for its Pedometer API. FlightMode only reads the accelerometer (Turbulence Test), which needs no permission — so the entry is stripped via `blockedPermissions`, and no Play Console permission declaration is needed.
- Day streak used the UTC date — now uses the device's local calendar day (travellers no longer lose a streak at UTC midnight).
- "Screen not found" page and the flight-ready notification were hardcoded English — now translated.
- `preflight.tsx` dead `SOUNDSCAPE_COUNT` constant removed.

- Logic-games update — hints, more levels, localized accessibility:
  - **Hint system** in all three logic games, each powered by the game's own solver: Runway Jam suggests the next optimal move (from the BFS solution), Sky Pixels reveals one logically-forced cell (line deduction from the current grid), Sun & Moon reveals one cell of the unique solution. Using any hint caps the level at 2 stars.
  - **More levels**, all solver-verified like the originals: Runway Jam +6 expert levels (13–18, optimal ≥ 16 moves), Sky Pixels +5 new 10×10 pictures (11–15, guess-free line-solvable), Sun & Moon +4 harder 8×8 levels (13–16, up to 52/64 blanks, exactly one solution each).
  - **Localized accessibility labels** in the logic games (previously hardcoded English piece/cell labels) — new `hint` + a11y keys in all 12 languages.
- Three new logic games focused on deductive thinking, each with hand-tuned levels whose solvability is proven by solver-backed unit tests (catalog: 33 → 36 games):
  - **Runway Jam** (`runway-jam`, strategy/medium) — Rush Hour-style sliding puzzle: free your plane's taxi path. 12 levels; a BFS solver verifies every level is solvable and that its stored optimal move count is exact (3 stars = optimal).
  - **Sky Pixels** (`nonogram`, brain/hard) — classic picross with aviation pixel art. 10 puzzles (5×5 → 10×10); a line-logic solver proves every puzzle is solvable without guessing, which also guarantees a unique solution.
  - **Sun & Moon** (`sun-moon`, brain/medium) — Takuzu/Binairo balance puzzle. 12 levels (4×4 → 8×8); a backtracking solver asserts each level has exactly one solution.
  - All three: per-level star ratings persisted via `levelStars`, level-select screens, new achievements (Ground Controller, Pixel Artist, Equilibrium) wired into the Play Games mapping, and translations in all 12 languages.
- Native bridge for pushing achievement unlocks to Play Games: a local Android-only Expo module (`modules/play-games/`, Kotlin over Play Games Services v2) exposing sign-in, achievement unlock/increment, and the achievements overlay. It's New-Architecture-safe (no unmaintained community lib), autolinked from `./modules`, and wired through `utils/playGames.ts`; the JS side stays a clean no-op on iOS / web / Expo Go. Achievement pushes still require the `CgkI…` Play IDs to be filled into `data/playGamesAchievements.ts`. (The Kotlin/Gradle build is only verifiable in a native build — see `documents/play-games-setup.md`.)
- Google Play Games Services SDK linked into the Android build. The `withPlayGames` config plugin now adds the `app_id` string resource, the `com.google.android.gms.games.APP_ID` manifest metadata, and the `com.google.android.gms:play-services-games-v2:21.0.0` gradle dependency, with the real Play Console app id (`944569415010`) wired via `app.json` `extra.playGamesAppId`. This bundles the SDK into the production AAB — satisfying Play Console's "add the Play Games SDK to your APK" gate — and, because Play Games v2 auto-initializes, enables automatic Play Games sign-in on launch with no extra code. This routes the next `main` release to a full native build (correct — PGS requires one). Pushing achievement unlocks from JS still needs a native bridge (tracked); see `documents/play-games-setup.md`.
- Google Play Games Services (PGS) scaffolding — inert and guarded, so it ships without affecting current behavior. A `utils/playGames.ts` wrapper resolves its native module dynamically at runtime and is a no-op in Expo Go / iOS / web / the current release build; after any local achievement unlock the app now best-effort mirrors it to Play Games (fire-and-forget, never blocks or crashes offline UX). Includes a `localAchievementId → Play ID` map (`data/playGamesAchievements.ts`, values pending), a launch-time silent sign-in bootstrap, an Expo config plugin for the PGS app-id manifest metadata (no-op until an id is configured), and a CI test guarding the map against drift. Activating PGS still needs Play Console/Google Cloud setup + a native module in a dev build — see `documents/play-games-setup.md`.

### Removed

- Removed the `tap-rush` game — pure fast-tapping with no targeting, a strict subset of Whack-a-Mole, so it was a redundant duplicate. Dropped its game module, registry entry, the `tap-champion` achievement, and its now-unused translation keys (across all 12 locales; the shared `tapRushScore` key is retained — Higher or Lower reuses it). Catalog is now 33 games. No other games were cut — the rest are distinct mechanics we're keeping.

### Changed (UX review — wave B)

- Home decluttered: removed the "Quick Actions" row (it duplicated the bottom tab bar) and promoted the Daily Flight Challenge to directly under the flight card, so the core retention hook is near the top instead of buried mid-scroll.
- Accessibility: the shared Game controls now expose localized Resume/Pause/Restart labels (were hardcoded English) across all 12 languages, and the Home flight-card close button gained a larger touch target (hitSlop) and a localized "Clear flight" label.
- Dark-theme contrast: added a per-theme `onTint` foreground token (dark uses a near-black navy on its pale-blue tint) and adopted it for every primary button and active filter/category/preference chip across Onboarding, Flight setup, Relax, Games, Explore, and Home. Previously white text sat on the light dark-theme tint (~1.6:1, well below WCAG); it's now high-contrast in all three themes.

### Fixed

- First-open crash in level-based games: selecting `levelStars ?? {}` from the Zustand store returned a fresh object on every snapshot while the game had no progress entry yet (i.e., for every player opening the game for the first time), which loops React's `useSyncExternalStore` until it throws "Maximum update depth exceeded". Reproduced against the app's exact React 19 + Zustand 5 versions and fixed by selecting the raw `levelStars` reference with a stable module-level `{}` fallback — in the three new logic games and in Stack Sort, which shipped with the same latent bug.

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
