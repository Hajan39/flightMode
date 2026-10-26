/**
 * Second half of the game smoke suite — see `gamesSmoke.test.ts` for what it
 * checks. Split only so Jest can run both halves on parallel workers.
 */
import "./helpers/gameMocks";

import { defineGamesSmoke } from "./helpers/gamesSmokeSuite";

defineGamesSmoke(1, 2);
