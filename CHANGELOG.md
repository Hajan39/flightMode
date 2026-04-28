# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Added a guarded PostHog analytics foundation for anonymous product events.
- Added first analytics events for app open, onboarding, flight setup, games, articles, relax, and ambient audio.

### Changed

- Reframed product documentation around FlightMode as an offline travel assistant plus entertainment system.
- Updated privacy documentation for anonymous product analytics and future online sync behavior.

### Fixed

- Repaired mojibake and broken symbols across cross-device game UIs and compact article content.


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
