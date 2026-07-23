# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary: a bored flyer with no or limited wifi — a passenger before, during, or after a flight who wants to pass time, calm down, or get quick practical flight info. Secondary (implied by pass-and-play/shared-screen games): a seatmate or travel companion playing alongside the primary user on one device.

## Product Purpose

FlightMode is an offline-first companion app for flights: games to kill time, ambient/relax audio for calming down, bite-sized destination/travel content, and simple flight-duration tracking. Success = the user opens it again on their *next* flight (retention), stays engaged 10–20 minutes per session, and returns for 2+ sessions.

## Positioning

The default app people download *before* a flight — not a single-purpose game or a single-purpose relax app, but the one offline companion that covers killing time, calming down, and flight-practical info together, with zero dependency on internet for core gameplay.

## Operating Context

Used mostly in airplane mode / no connectivity, often in a cramped seat, one-handed or with a tray table, sometimes at night (dark theme relevant) or during takeoff/landing (short bursts, quick resume). Content (games, relax audio, destination articles) must work fully offline; any remote sync (content, analytics) is opportunistic and never blocking.

## Capabilities and Constraints

- 33 games across brain/reflex/strategy/multiplayer categories, all self-contained modules driven by a single registry (`data/games.ts`).
- Manual flight-duration tracking (no GPS/flight-data integration) — user enters duration, app derives elapsed/remaining.
- Relax tab: breathing exercise + ambient audio + sleep timer.
- 44 bundled offline articles (destination tips), localized in en/cs/de; other locales fall back to en.
- 12 supported UI languages.
- Four theme modes: system/light/dark/crazy — no OS-specific visual split exists in code today despite the "adaptive" platform tag; that divergence is a forward-looking option, not a current fact.
- Anonymous-only analytics (PostHog) — never personal data, exact location, flight number, or free-form text; offline UX must never depend on analytics/sync succeeding.
- No ads, no paywalls on core UX (product principle, not yet a technical constraint since no monetization exists yet).

## Brand Commitments

App name "FlightMode", existing app icon, and the current theme-token system (light/dark/crazy palettes in `constants/Colors.ts`) are the only binding brand facts. No fixed voice, tagline, or marketing identity beyond these.

## Evidence on Hand

No user research, testimonials, press, or usage data on hand — do not fabricate any. Product facts above are derived from the existing codebase (CLAUDE.md, `data/games.ts`, `store/`) and the stated roadmap, not from external evidence.

## Product Principles

- Every feature must pass: "does this help the user survive the flight?" — if no, don't build it.
- Core gameplay and relax/content features must never require internet.
- Retention (return for next flight) and session depth (10–20 min) matter more than acquisition or vanity metrics.
- No ads, no paywalls on core UX; monetization (if ever) only after retention is proven.
- Avoid feature sprawl — focus beats breadth at this stage (Phase 1: polish, not expand).

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond general good practice (contrast, touch targets, haptics already used for feedback). Known debt: hook dependency warnings, index-based list keys — not accessibility-blocking but noted in CLAUDE.md.
