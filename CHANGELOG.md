# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Added a guarded PostHog analytics foundation for anonymous product events.
- Added first analytics events for app open, onboarding, flight setup, games, articles, relax, and ambient audio.
- Added an Expo Network foundation for online/offline status and anonymous connectivity-change analytics.
- Added an article sync foundation with optional remote endpoint caching and bundled-content fallback.
- Added an article sync network preference for Wi-Fi only, Wi-Fi plus mobile data, or off.
- Added anonymous analytics coverage for Settings, Profile, Home quick actions, Home article recommendations, and Explore discovery controls.
- Added intent-based Games filters for quick, play-together, and longer sessions.

### Changed

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

### Fixed

- Repaired mojibake and broken symbols across cross-device game UIs and compact article content.
- Completed UI translation key coverage across all supported app languages.
- Fixed Reaction Timer progress so one completed session records one play and shows a result overlay.
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
