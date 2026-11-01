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
  /** Same id as the adult game whose idea (and folder) it shares. */
  id: string;
  /** One short word under the picture (never needed to play). */
  labelKey: TranslationKey;
  loadComponent: () => ComponentType<KidsGameProps>;
  tile: KidsTileToken;
}

/**
 * Kids-mode games (ages 3–6): picture-only variants of six existing games,
 * each in `games/<id>/kids.tsx`. No timers, lives, scores or losing, and
 * they never record progress (see CLAUDE.md "Kids mode").
 */
export const kidsGames: readonly KidsGameDefinition[] = [
  {
    emoji: "🐶",
    id: "memory",
    labelKey: "kidsGameMemory",
    loadComponent: () => require("@/games/memory/kids").default,
    tile: "kidsTile1",
  },
  {
    emoji: "🔍",
    id: "odd-one-out",
    labelKey: "kidsGameOddOneOut",
    loadComponent: () => require("@/games/odd-one-out/kids").default,
    tile: "kidsTile2",
  },
  {
    emoji: "🦜",
    id: "simon-says",
    labelKey: "kidsGameSimonSays",
    loadComponent: () => require("@/games/simon-says/kids").default,
    tile: "kidsTile3",
  },
  {
    emoji: "🐹",
    id: "whack-mole",
    labelKey: "kidsGameWhackMole",
    loadComponent: () => require("@/games/whack-mole/kids").default,
    tile: "kidsTile4",
  },
  {
    emoji: "🧩",
    id: "sliding-puzzle",
    labelKey: "kidsGameSlidingPuzzle",
    loadComponent: () => require("@/games/sliding-puzzle/kids").default,
    tile: "kidsTile5",
  },
  {
    emoji: "🧺",
    id: "cargo-catch",
    labelKey: "kidsGameCargoCatch",
    loadComponent: () => require("@/games/cargo-catch/kids").default,
    tile: "kidsTile6",
  },
];

export function getKidsGame(id: string): KidsGameDefinition | undefined {
  return kidsGames.find((g) => g.id === id);
}
