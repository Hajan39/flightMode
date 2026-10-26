/**
 * Render smoke test for EVERY game in `gameRegistry`: "can this game actually
 * be played?". Each game is mounted with the real shared UI (PlayerSetup,
 * PassDeviceOverlay, GameCountdown, GameResult …); only native / platform
 * modules are mocked. A driver then gets past the setup screen and plays:
 *  - by default a seeded "monkey" (prefers Start / Ready / Go buttons, then
 *    taps random enabled controls, swipes where the game takes gestures);
 *  - puzzles get small drivers that read the board from the screen and solve
 *    it (Lights Out, Sudoku, 15-puzzle, Stack Sort, word search …) or follow
 *    the in-game hint button (Nonogram, Sun & Moon, Runway Jam, Mahjong).
 * Time advances in small fake-timer steps (React re-renders between ticks, as
 * on a device). Every game must: render without throwing or console.error,
 * visibly change, and — unless `ends: false` with a stated reason — reach its
 * end state and call updateProgress (recordMatch goes through it) exactly
 * once. Regressions this catches: Flight Path never spawning planes, Duel
 * Dice / Emoji Find / Split Duel timers killed by an effect cleanup (verified
 * against the pre-fix versions).
 *
 * A game that fails here is a real bug: mark its spec `knownBug: "…"` (runs
 * as test.failing, so CI stays green while the bug stays visible) — never
 * skip it.
 */
import "./helpers/gameMocks";

import { defineGamesSmoke } from "./helpers/gamesSmokeSuite";

// Shard 1 of 2 (the other half: gamesSmoke.part2.test.ts — parallel workers).
defineGamesSmoke(0, 2);
