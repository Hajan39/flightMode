import type { ComponentType } from "react";

import type { TranslationKey } from "@/i18n/translations";

/** Props every kids-mode game variant receives from `app/kids/[id].tsx`. */
export interface KidsGameProps {
  /** Back to the kids home (the 🏠 on the celebration screen). */
  onHome: () => void;
}

export type KidsTileToken =
  | "kidsTile1"
  | "kidsTile2"
  | "kidsTile3"
  | "kidsTile4"
  | "kidsTile5"
  | "kidsTile6";

export interface KidsGameDefinition {
  /** Big picture on the kids home tile. */
  emoji: string;
  /** Folder id (`games/<id>/kids.tsx`); shared with the adult game when it has one. */
  id: string;
  /** One short word under the picture (never needed to play). */
  labelKey: TranslationKey;
  loadComponent: () => ComponentType<KidsGameProps>;
  tile: KidsTileToken;
}

/**
 * Kids-mode games (ages 3–6), simplest first. Each lives in
 * `games/<id>/kids.tsx`: six picture-only variants of adult games (memory,
 * odd-one-out, simon-says, whack-mole, sliding-puzzle, cargo-catch) and six
 * kids-only games (colouring, shadows, counting, shapes, dot-to-dot, maze)
 * that are not in the adult registry. No timers, lives, scores or losing,
 * and they never record progress (see CLAUDE.md "Kids mode"). Tile colours
 * cycle through the six kid tokens.
 */
export const kidsGames: readonly KidsGameDefinition[] = [
  {
    emoji: "🐹",
    id: "whack-mole",
    labelKey: "kidsGameWhackMole",
    loadComponent: () => require("@/games/whack-mole/kids").default,
    tile: "kidsTile1",
  },
  {
    emoji: "🖍️",
    id: "colouring",
    labelKey: "kidsGameColouring",
    loadComponent: () => require("@/games/colouring/kids").default,
    tile: "kidsTile2",
  },
  {
    emoji: "🔍",
    id: "odd-one-out",
    labelKey: "kidsGameOddOneOut",
    loadComponent: () => require("@/games/odd-one-out/kids").default,
    tile: "kidsTile3",
  },
  {
    emoji: "🦒",
    id: "shadows",
    labelKey: "kidsGameShadows",
    loadComponent: () => require("@/games/shadows/kids").default,
    tile: "kidsTile4",
  },
  {
    emoji: "🍎",
    id: "counting",
    labelKey: "kidsGameCounting",
    loadComponent: () => require("@/games/counting/kids").default,
    tile: "kidsTile5",
  },
  {
    emoji: "🐶",
    id: "memory",
    labelKey: "kidsGameMemory",
    loadComponent: () => require("@/games/memory/kids").default,
    tile: "kidsTile6",
  },
  {
    emoji: "⭐",
    id: "shapes",
    labelKey: "kidsGameShapes",
    loadComponent: () => require("@/games/shapes/kids").default,
    tile: "kidsTile1",
  },
  {
    emoji: "🧺",
    id: "cargo-catch",
    labelKey: "kidsGameCargoCatch",
    loadComponent: () => require("@/games/cargo-catch/kids").default,
    tile: "kidsTile2",
  },
  {
    emoji: "✏️",
    id: "dot-to-dot",
    labelKey: "kidsGameDotToDot",
    loadComponent: () => require("@/games/dot-to-dot/kids").default,
    tile: "kidsTile3",
  },
  {
    emoji: "🦜",
    id: "simon-says",
    labelKey: "kidsGameSimonSays",
    loadComponent: () => require("@/games/simon-says/kids").default,
    tile: "kidsTile4",
  },
  {
    emoji: "🐾",
    id: "maze",
    labelKey: "kidsGameMaze",
    loadComponent: () => require("@/games/maze/kids").default,
    tile: "kidsTile5",
  },
  {
    emoji: "🧩",
    id: "sliding-puzzle",
    labelKey: "kidsGameSlidingPuzzle",
    loadComponent: () => require("@/games/sliding-puzzle/kids").default,
    tile: "kidsTile6",
  },
];

export function getKidsGame(id: string): KidsGameDefinition | undefined {
  return kidsGames.find((g) => g.id === id);
}
