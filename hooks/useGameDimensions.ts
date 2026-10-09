import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";

export interface GameViewport {
  height: number;
  width: number;
}

/**
 * Games are designed for a portrait phone. On a landscape tablet or desktop
 * window the full window is wider than it is tall, and boards sized from the
 * window width overflow vertically. The game host renders every game inside a
 * centred column whose width never exceeds this share of the window height.
 */
const MAX_WIDTH_TO_HEIGHT = 0.75;

/** Width of the portrait column a game gets inside a window of this size. */
export function gameColumnWidth(width: number, height: number): number {
  return Math.min(width, Math.round(height * MAX_WIDTH_TO_HEIGHT));
}

const GameViewportContext = createContext<GameViewport | null>(null);

export const GameViewportProvider = GameViewportContext.Provider;

/**
 * Drop-in replacement for `useWindowDimensions` inside games: returns the size
 * of the game column (see `app/game/[id].tsx`), so board math that assumes a
 * portrait screen keeps working on large and landscape screens. Falls back to
 * the window outside the game host (tests, previews).
 */
export function useGameDimensions(): GameViewport {
  const window = useWindowDimensions();
  const viewport = useContext(GameViewportContext);
  return viewport ?? { height: window.height, width: window.width };
}
