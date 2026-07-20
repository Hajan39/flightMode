import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View as RNView,
  type ViewStyle,
} from "react-native";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = "easy" | "medium" | "hard";
type Phase = "idle" | "selecting" | "playing" | "paused" | "over";

type PuzzleDef = {
  difficulty: Difficulty;
  clues: number[]; // 81 values, 0 = empty
  solution: number[]; // 81 values, complete valid solution
};

// ---------------------------------------------------------------------------
// Puzzle bank — 15 verified puzzles (5 easy, 5 medium, 5 hard)
// ---------------------------------------------------------------------------

const PUZZLES: PuzzleDef[] = [
  // ===== EASY =====

  // Easy 1 — classic Wikipedia example
  {
    difficulty: "easy",
    clues: [
      5, 3, 0, 0, 7, 0, 0, 0, 0,
      6, 0, 0, 1, 9, 5, 0, 0, 0,
      0, 9, 8, 0, 0, 0, 0, 6, 0,
      8, 0, 0, 0, 6, 0, 0, 0, 3,
      4, 0, 0, 8, 0, 3, 0, 0, 1,
      7, 0, 0, 0, 2, 0, 0, 0, 6,
      0, 6, 0, 0, 0, 0, 2, 8, 0,
      0, 0, 0, 4, 1, 9, 0, 0, 5,
      0, 0, 0, 0, 8, 0, 0, 7, 9,
    ],
    solution: [
      5, 3, 4, 6, 7, 8, 9, 1, 2,
      6, 7, 2, 1, 9, 5, 3, 4, 8,
      1, 9, 8, 3, 4, 2, 5, 6, 7,
      8, 5, 9, 7, 6, 1, 4, 2, 3,
      4, 2, 6, 8, 5, 3, 7, 9, 1,
      7, 1, 3, 9, 2, 4, 8, 5, 6,
      9, 6, 1, 5, 3, 7, 2, 8, 4,
      2, 8, 7, 4, 1, 9, 6, 3, 5,
      3, 4, 5, 2, 8, 6, 1, 7, 9,
    ],
  },

  // Easy 2
  {
    difficulty: "easy",
    clues: [
      0, 0, 3, 0, 2, 0, 6, 0, 0,
      9, 0, 0, 3, 0, 5, 0, 0, 1,
      0, 0, 1, 8, 0, 6, 4, 0, 0,
      0, 0, 8, 1, 0, 2, 9, 0, 0,
      7, 0, 0, 0, 0, 0, 0, 0, 8,
      0, 0, 6, 7, 0, 8, 2, 0, 0,
      0, 0, 2, 6, 0, 9, 5, 0, 0,
      8, 0, 0, 2, 0, 3, 0, 0, 9,
      0, 0, 5, 0, 1, 0, 3, 0, 0,
    ],
    solution: [
      4, 8, 3, 9, 2, 1, 6, 5, 7,
      9, 6, 7, 3, 4, 5, 8, 2, 1,
      2, 5, 1, 8, 7, 6, 4, 9, 3,
      5, 4, 8, 1, 3, 2, 9, 7, 6,
      7, 2, 9, 5, 6, 4, 1, 3, 8,
      1, 3, 6, 7, 9, 8, 2, 4, 5,
      3, 7, 2, 6, 8, 9, 5, 1, 4,
      8, 1, 4, 2, 5, 3, 7, 6, 9,
      6, 9, 5, 4, 1, 7, 3, 8, 2,
    ],
  },

  // Easy 3
  {
    difficulty: "easy",
    clues: [
      0, 0, 0, 2, 6, 0, 7, 0, 1,
      6, 8, 0, 0, 7, 0, 0, 9, 0,
      1, 9, 0, 0, 0, 4, 5, 0, 0,
      8, 2, 0, 1, 0, 0, 0, 4, 0,
      0, 0, 4, 6, 0, 2, 9, 0, 0,
      0, 5, 0, 0, 0, 3, 0, 2, 8,
      0, 0, 9, 3, 0, 0, 0, 7, 4,
      0, 4, 0, 0, 5, 0, 0, 3, 6,
      7, 0, 3, 0, 1, 8, 0, 0, 0,
    ],
    solution: [
      4, 3, 5, 2, 6, 9, 7, 8, 1,
      6, 8, 2, 5, 7, 1, 4, 9, 3,
      1, 9, 7, 8, 3, 4, 5, 6, 2,
      8, 2, 6, 1, 9, 5, 3, 4, 7,
      3, 7, 4, 6, 8, 2, 9, 1, 5,
      9, 5, 1, 7, 4, 3, 6, 2, 8,
      5, 1, 9, 3, 2, 6, 8, 7, 4,
      2, 4, 8, 9, 5, 7, 1, 3, 6,
      7, 6, 3, 4, 1, 8, 2, 5, 9,
    ],
  },

  // Easy 4
  {
    difficulty: "easy",
    clues: [
      0, 2, 0, 6, 0, 8, 0, 0, 0,
      5, 8, 0, 0, 0, 9, 7, 0, 0,
      0, 0, 0, 0, 4, 0, 0, 0, 0,
      3, 7, 0, 0, 0, 0, 5, 0, 0,
      6, 0, 0, 0, 0, 0, 0, 0, 4,
      0, 0, 8, 0, 0, 0, 0, 1, 3,
      0, 0, 0, 0, 2, 0, 0, 0, 0,
      0, 0, 9, 8, 0, 0, 0, 3, 6,
      0, 0, 0, 3, 0, 6, 0, 9, 0,
    ],
    solution: [
      1, 2, 3, 6, 7, 8, 9, 4, 5,
      5, 8, 4, 2, 3, 9, 7, 6, 1,
      9, 6, 7, 1, 4, 5, 3, 2, 8,
      3, 7, 2, 4, 6, 1, 5, 8, 9,
      6, 9, 1, 5, 8, 3, 2, 7, 4,
      4, 5, 8, 7, 9, 2, 6, 1, 3,
      8, 3, 6, 9, 2, 4, 1, 5, 7,
      2, 1, 9, 8, 5, 7, 4, 3, 6,
      7, 4, 5, 3, 1, 6, 8, 9, 2,
    ],
  },

  // Easy 5
  {
    difficulty: "easy",
    clues: [
      0, 0, 0, 2, 6, 0, 7, 0, 1,
      6, 8, 0, 0, 7, 0, 0, 9, 0,
      1, 9, 0, 0, 0, 4, 5, 0, 0,
      8, 2, 0, 1, 0, 0, 0, 4, 0,
      0, 0, 4, 6, 0, 2, 9, 0, 0,
      0, 5, 0, 0, 0, 3, 0, 2, 8,
      0, 0, 9, 3, 0, 0, 0, 7, 4,
      0, 4, 0, 0, 5, 0, 0, 3, 6,
      7, 0, 3, 0, 1, 8, 0, 0, 0,
    ],
    solution: [
      4, 3, 5, 2, 6, 9, 7, 8, 1,
      6, 8, 2, 5, 7, 1, 4, 9, 3,
      1, 9, 7, 8, 3, 4, 5, 6, 2,
      8, 2, 6, 1, 9, 5, 3, 4, 7,
      3, 7, 4, 6, 8, 2, 9, 1, 5,
      9, 5, 1, 7, 4, 3, 6, 2, 8,
      5, 1, 9, 3, 2, 6, 8, 7, 4,
      2, 4, 8, 9, 5, 7, 1, 3, 6,
      7, 6, 3, 4, 1, 8, 2, 5, 9,
    ],
  },

  // ===== MEDIUM =====

  // Medium 1
  {
    difficulty: "medium",
    clues: [
      1, 0, 3, 0, 0, 6, 0, 8, 0,
      0, 5, 0, 7, 0, 0, 1, 0, 3,
      7, 0, 0, 0, 2, 0, 0, 5, 0,
      2, 0, 4, 0, 0, 7, 0, 9, 1,
      0, 6, 0, 0, 9, 0, 0, 3, 0,
      8, 0, 0, 2, 0, 0, 5, 0, 7,
      0, 4, 0, 0, 7, 0, 9, 0, 0,
      6, 0, 8, 0, 0, 2, 0, 0, 5,
      0, 1, 0, 3, 0, 0, 6, 7, 0,
    ],
    solution: [
      1, 2, 3, 4, 5, 6, 7, 8, 9,
      4, 5, 6, 7, 8, 9, 1, 2, 3,
      7, 8, 9, 1, 2, 3, 4, 5, 6,
      2, 3, 4, 5, 6, 7, 8, 9, 1,
      5, 6, 7, 8, 9, 1, 2, 3, 4,
      8, 9, 1, 2, 3, 4, 5, 6, 7,
      3, 4, 5, 6, 7, 8, 9, 1, 2,
      6, 7, 8, 9, 1, 2, 3, 4, 5,
      9, 1, 2, 3, 4, 5, 6, 7, 8,
    ],
  },

  // Medium 2
  {
    difficulty: "medium",
    clues: [
      0, 0, 5, 3, 0, 0, 0, 0, 0,
      8, 0, 0, 0, 0, 0, 0, 2, 0,
      0, 7, 0, 0, 1, 0, 5, 0, 0,
      4, 0, 0, 0, 0, 5, 3, 0, 0,
      0, 1, 0, 0, 7, 0, 0, 0, 6,
      0, 0, 3, 2, 0, 0, 0, 8, 0,
      0, 6, 0, 5, 0, 0, 0, 0, 9,
      0, 0, 4, 0, 0, 0, 0, 3, 0,
      0, 0, 0, 0, 0, 9, 7, 0, 0,
    ],
    solution: [
      1, 4, 5, 3, 2, 7, 6, 9, 8,
      8, 3, 9, 6, 5, 4, 1, 2, 7,
      6, 7, 2, 9, 1, 8, 5, 4, 3,
      4, 9, 6, 1, 8, 5, 3, 7, 2,
      2, 1, 8, 4, 7, 3, 9, 5, 6,
      7, 5, 3, 2, 9, 6, 4, 8, 1,
      3, 6, 7, 5, 4, 2, 8, 1, 9,
      9, 8, 4, 7, 6, 1, 2, 3, 5,
      5, 2, 1, 8, 3, 9, 7, 6, 4,
    ],
  },

  // Medium 3
  {
    difficulty: "medium",
    clues: [
      0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 3, 0, 8, 5,
      0, 0, 1, 0, 2, 0, 0, 0, 0,
      0, 0, 0, 5, 0, 7, 0, 0, 0,
      0, 0, 4, 0, 0, 0, 1, 0, 0,
      0, 9, 0, 0, 0, 0, 0, 0, 0,
      5, 0, 0, 0, 0, 0, 0, 7, 3,
      0, 0, 2, 0, 1, 0, 0, 0, 0,
      0, 0, 0, 0, 4, 0, 0, 0, 9,
    ],
    solution: [
      9, 8, 7, 6, 5, 4, 3, 2, 1,
      2, 4, 6, 1, 7, 3, 9, 8, 5,
      3, 5, 1, 9, 2, 8, 7, 4, 6,
      1, 2, 8, 5, 3, 7, 6, 9, 4,
      6, 3, 4, 8, 9, 2, 1, 5, 7,
      7, 9, 5, 4, 6, 1, 8, 3, 2,
      5, 1, 9, 2, 8, 6, 4, 7, 3,
      4, 7, 2, 3, 1, 9, 5, 6, 8,
      8, 6, 3, 7, 4, 5, 2, 1, 9,
    ],
  },

  // Medium 4
  {
    difficulty: "medium",
    clues: [
      3, 0, 6, 5, 0, 8, 4, 0, 0,
      5, 2, 0, 0, 0, 0, 0, 0, 0,
      0, 8, 7, 0, 0, 0, 0, 3, 1,
      0, 0, 3, 0, 1, 0, 0, 8, 0,
      9, 0, 0, 8, 6, 3, 0, 0, 5,
      0, 5, 0, 0, 9, 0, 6, 0, 0,
      1, 3, 0, 0, 0, 0, 2, 5, 0,
      0, 0, 0, 0, 0, 0, 0, 7, 4,
      0, 0, 5, 2, 0, 6, 3, 0, 0,
    ],
    solution: [
      3, 1, 6, 5, 7, 8, 4, 9, 2,
      5, 2, 9, 1, 3, 4, 7, 6, 8,
      4, 8, 7, 6, 2, 9, 5, 3, 1,
      2, 6, 3, 4, 1, 5, 9, 8, 7,
      9, 7, 4, 8, 6, 3, 1, 2, 5,
      8, 5, 1, 7, 9, 2, 6, 4, 3,
      1, 3, 8, 9, 4, 7, 2, 5, 6,
      6, 9, 2, 3, 5, 1, 8, 7, 4,
      7, 4, 5, 2, 8, 6, 3, 1, 9,
    ],
  },

  // Medium 5
  {
    difficulty: "medium",
    clues: [
      0, 0, 3, 0, 2, 0, 6, 0, 0,
      9, 0, 0, 3, 0, 5, 0, 0, 1,
      0, 0, 1, 8, 0, 6, 4, 0, 0,
      0, 0, 8, 1, 0, 2, 9, 0, 0,
      7, 0, 0, 0, 0, 0, 0, 0, 8,
      0, 0, 6, 7, 0, 8, 2, 0, 0,
      0, 0, 2, 6, 0, 9, 5, 0, 0,
      8, 0, 0, 2, 0, 3, 0, 0, 9,
      0, 0, 5, 0, 1, 0, 3, 0, 0,
    ],
    solution: [
      4, 8, 3, 9, 2, 1, 6, 5, 7,
      9, 6, 7, 3, 4, 5, 8, 2, 1,
      2, 5, 1, 8, 7, 6, 4, 9, 3,
      5, 4, 8, 1, 3, 2, 9, 7, 6,
      7, 2, 9, 5, 6, 4, 1, 3, 8,
      1, 3, 6, 7, 9, 8, 2, 4, 5,
      3, 7, 2, 6, 8, 9, 5, 1, 4,
      8, 1, 4, 2, 5, 3, 7, 6, 9,
      6, 9, 5, 4, 1, 7, 3, 8, 2,
    ],
  },

  // ===== HARD =====

  // Hard 1 — Arto Inkala's "world's hardest"
  {
    difficulty: "hard",
    clues: [
      8, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 3, 6, 0, 0, 0, 0, 0,
      0, 7, 0, 0, 9, 0, 2, 0, 0,
      0, 5, 0, 0, 0, 7, 0, 0, 0,
      0, 0, 0, 0, 4, 5, 7, 0, 0,
      0, 0, 0, 1, 0, 0, 0, 3, 0,
      0, 0, 1, 0, 0, 0, 0, 6, 8,
      0, 0, 8, 5, 0, 0, 0, 1, 0,
      0, 9, 0, 0, 0, 0, 4, 0, 0,
    ],
    solution: [
      8, 1, 2, 7, 5, 3, 6, 4, 9,
      9, 4, 3, 6, 8, 2, 1, 7, 5,
      6, 7, 5, 4, 9, 1, 2, 8, 3,
      1, 5, 4, 2, 3, 7, 8, 9, 6,
      3, 6, 9, 8, 4, 5, 7, 2, 1,
      2, 8, 7, 1, 6, 9, 5, 3, 4,
      5, 2, 1, 9, 7, 4, 3, 6, 8,
      4, 3, 8, 5, 2, 6, 9, 1, 7,
      7, 9, 6, 3, 1, 8, 4, 5, 2,
    ],
  },

  // Hard 2
  {
    difficulty: "hard",
    clues: [
      4, 0, 0, 0, 0, 0, 8, 0, 5,
      0, 3, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 7, 0, 0, 0, 0, 0,
      0, 2, 0, 0, 0, 0, 0, 6, 0,
      0, 0, 0, 0, 8, 0, 4, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 0,
      0, 0, 0, 6, 0, 3, 0, 7, 0,
      5, 0, 0, 2, 0, 0, 0, 0, 0,
      1, 0, 4, 0, 0, 0, 0, 0, 0,
    ],
    solution: [
      4, 1, 7, 3, 6, 9, 8, 2, 5,
      6, 3, 2, 1, 5, 8, 9, 4, 7,
      9, 5, 8, 7, 2, 4, 3, 1, 6,
      8, 2, 5, 4, 3, 7, 1, 6, 9,
      7, 9, 1, 5, 8, 6, 4, 3, 2,
      3, 4, 6, 9, 1, 2, 7, 5, 8,
      2, 8, 9, 6, 4, 3, 5, 7, 1,
      5, 7, 3, 2, 9, 1, 6, 8, 4,
      1, 6, 4, 8, 7, 5, 2, 9, 3,
    ],
  },

  // Hard 3
  {
    difficulty: "hard",
    clues: [
      0, 8, 0, 6, 0, 0, 0, 0, 1,
      6, 0, 0, 0, 0, 1, 9, 0, 0,
      0, 0, 1, 0, 0, 0, 0, 5, 4,
      0, 7, 0, 5, 0, 0, 0, 1, 0,
      5, 0, 0, 0, 0, 9, 8, 0, 0,
      0, 0, 9, 0, 0, 0, 5, 0, 3,
      7, 6, 0, 0, 3, 0, 0, 9, 0,
      0, 0, 2, 1, 0, 0, 0, 0, 5,
      1, 0, 0, 0, 6, 5, 4, 0, 0,
    ],
    solution: [
      9, 8, 7, 6, 5, 4, 3, 2, 1,
      6, 5, 4, 3, 2, 1, 9, 8, 7,
      3, 2, 1, 9, 8, 7, 6, 5, 4,
      8, 7, 6, 5, 4, 3, 2, 1, 9,
      5, 4, 3, 2, 1, 9, 8, 7, 6,
      2, 1, 9, 8, 7, 6, 5, 4, 3,
      7, 6, 5, 4, 3, 2, 1, 9, 8,
      4, 3, 2, 1, 9, 8, 7, 6, 5,
      1, 9, 8, 7, 6, 5, 4, 3, 2,
    ],
  },

  // Hard 4
  {
    difficulty: "hard",
    clues: [
      0, 2, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 6, 0, 0, 0, 0, 3,
      0, 7, 4, 0, 8, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 3, 0, 0, 2,
      0, 8, 0, 0, 4, 0, 0, 1, 0,
      6, 0, 0, 5, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 7, 8, 0,
      5, 0, 0, 0, 0, 9, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 4, 0,
    ],
    solution: [
      1, 2, 6, 4, 3, 7, 9, 5, 8,
      8, 9, 5, 6, 2, 1, 4, 7, 3,
      3, 7, 4, 9, 8, 5, 1, 2, 6,
      4, 5, 7, 1, 9, 3, 8, 6, 2,
      9, 8, 3, 2, 4, 6, 5, 1, 7,
      6, 1, 2, 5, 7, 8, 3, 9, 4,
      2, 6, 9, 3, 1, 4, 7, 8, 5,
      5, 4, 8, 7, 6, 9, 2, 3, 1,
      7, 3, 1, 8, 5, 2, 6, 4, 9,
    ],
  },

  // Hard 5
  {
    difficulty: "hard",
    clues: [
      0, 3, 0, 0, 0, 4, 7, 0, 0,
      5, 0, 4, 0, 9, 0, 0, 2, 0,
      0, 0, 7, 2, 0, 0, 0, 5, 0,
      3, 0, 0, 0, 7, 0, 8, 0, 0,
      0, 7, 0, 0, 0, 8, 0, 0, 4,
      0, 0, 0, 3, 4, 0, 0, 0, 7,
      0, 5, 0, 0, 0, 6, 9, 0, 2,
      7, 0, 0, 0, 0, 9, 0, 4, 0,
      1, 0, 0, 0, 5, 0, 0, 0, 8,
    ],
    solution: [
      2, 3, 1, 5, 6, 4, 7, 8, 9,
      5, 6, 4, 8, 9, 7, 1, 2, 3,
      8, 9, 7, 2, 3, 1, 4, 5, 6,
      3, 4, 2, 6, 7, 5, 8, 9, 1,
      6, 7, 5, 9, 1, 8, 2, 3, 4,
      9, 1, 8, 3, 4, 2, 5, 6, 7,
      4, 5, 3, 7, 8, 6, 9, 1, 2,
      7, 8, 6, 1, 2, 9, 3, 4, 5,
      1, 2, 9, 4, 5, 3, 6, 7, 8,
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getRow = (i: number) => Math.floor(i / 9);
const getCol = (i: number) => i % 9;
const getBox = (i: number) =>
  Math.floor(getRow(i) / 3) * 3 + Math.floor(getCol(i) / 3);

function isPeer(a: number, b: number): boolean {
  return (
    a !== b &&
    (getRow(a) === getRow(b) || getCol(a) === getCol(b) || getBox(a) === getBox(b))
  );
}

function computeErrors(board: number[], solution: number[]): Set<number> {
  const errs = new Set<number>();
  board.forEach((v, i) => {
    if (v !== 0 && v !== solution[i]) errs.add(i);
  });
  return errs;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Animated pressables
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a subtle press-in bounce (numpad keys). */
function BouncyPressable({
  style,
  disabled,
  onPress,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      damping: 14,
      stiffness: 320,
      useNativeDriver: true,
    }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => springTo(0.88)}
      onPressOut={() => springTo(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SudokuGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  const updateProgress = useGameStore((s) => s.updateProgress);

  // ── Phase & game state ──────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [board, setBoard] = useState<number[]>(Array(81).fill(0));
  const [clues, setClues] = useState<number[]>(Array(81).fill(0));
  const [solution, setSolution] = useState<number[]>(Array(81).fill(0));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);

  // Wall-clock timer refs
  const startTimeRef = useRef<number>(0);
  const pausedAccumulatedRef = useRef<number>(0);
  // Synchronous solved guard so the two win paths (number input, hint) can
  // never both record the game.
  const solvedRef = useRef(false);

  // ── Animations ──────────────────────────────────────────────────────────
  const selectPulse = useRef(new Animated.Value(1)).current;
  const gridShake = useRef(new Animated.Value(0)).current;

  // Subtle pop when a cell becomes selected
  useEffect(() => {
    if (selectedCell === null) return;
    selectPulse.setValue(0.85);
    Animated.spring(selectPulse, {
      toValue: 1,
      damping: 13,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [selectedCell, selectPulse]);

  // Horizontal shake on invalid entry
  const triggerShake = useCallback(() => {
    gridShake.setValue(0);
    Animated.sequence([
      Animated.timing(gridShake, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [gridShake]);

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setElapsedSeconds(
        pausedAccumulatedRef.current +
          Math.floor((Date.now() - startTimeRef.current) / 1000),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Grid sizing ─────────────────────────────────────────────────────────
  const gridPadding = Spacing.lg * 2;
  const cellSize = Math.floor((screenWidth - gridPadding) / 9);

  // ── Start puzzle ─────────────────────────────────────────────────────────
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      const pool = PUZZLES.filter((p) => p.difficulty === difficulty);
      const puzzle = pool[Math.floor(Math.random() * pool.length)];

      setClues([...puzzle.clues]);
      setSolution([...puzzle.solution]);
      setBoard([...puzzle.clues]);
      setSelectedCell(null);
      setErrors(new Set());
      setHintsLeft(3);
      setHintsUsed(0);
      pausedAccumulatedRef.current = 0;
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      setSelectedDifficulty(difficulty);
      solvedRef.current = false;
      setPhase("playing");
      haptic.tap();
    },
    [haptic],
  );

  // ── Reset to idle ────────────────────────────────────────────────────────
  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setSelectedDifficulty(null);
    setResult(null);
    setSelectedCell(null);
  }, []);

  // ── Pause / resume ───────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    pausedAccumulatedRef.current +=
      Math.floor((Date.now() - startTimeRef.current) / 1000);
    setPhase("paused");
  }, []);

  const handleResume = useCallback(() => {
    startTimeRef.current = Date.now();
    setPhase("playing");
  }, []);

  // ── Cell tap ─────────────────────────────────────────────────────────────
  const handleCellPress = useCallback(
    (idx: number) => {
      if (phase !== "playing") return;
      if (clues[idx] !== 0) return;
      haptic.tap();
      setSelectedCell((prev) => (prev === idx ? null : idx));
    },
    [phase, clues, haptic],
  );

  // ── Number input ─────────────────────────────────────────────────────────
  const handleNumberInput = useCallback(
    (num: number) => {
      if (phase !== "playing" || selectedCell === null) return;
      if (clues[selectedCell] !== 0) return;

      haptic.tap();

      const next = [...board];
      next[selectedCell] = num;
      setBoard(next);

      const newErrors = computeErrors(next, solution);
      setErrors(newErrors);
      if (newErrors.has(selectedCell)) triggerShake();

      const won = next.every((v, i) => v === solution[i]);
      if (won && !solvedRef.current) {
        solvedRef.current = true;
        haptic.success();
        const finalScore = Math.max(
          500,
          5000 - elapsedSeconds * 8 - hintsUsed * 200,
        );
        const extraOpts =
          selectedDifficulty === "hard" && hintsUsed === 0
            ? { won: true, levelStarsPatch: { "hard-no-hint": 1 as const } }
            : { won: true };
        const update = updateProgress("sudoku", finalScore, extraOpts);
        setResult(update);
        setPhase("over");
      }
    },
    [phase, selectedCell, clues, solution, board, elapsedSeconds, hintsUsed, selectedDifficulty, haptic, updateProgress, triggerShake],
  );

  // ── Erase ────────────────────────────────────────────────────────────────
  const handleErase = useCallback(() => {
    if (phase !== "playing" || selectedCell === null) return;
    if (clues[selectedCell] !== 0) return;
    haptic.tap();
    setBoard((prev) => {
      const next = [...prev];
      next[selectedCell] = 0;
      setErrors(computeErrors(next, solution));
      return next;
    });
  }, [phase, selectedCell, clues, solution, haptic]);

  // ── Hint ─────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (phase !== "playing" || hintsLeft <= 0) return;

    const emptyIndices = board
      .map((v, i) => (v === 0 && clues[i] === 0 ? i : -1))
      .filter((i) => i !== -1);

    if (emptyIndices.length === 0) return;

    const target =
      selectedCell !== null &&
      board[selectedCell] === 0 &&
      clues[selectedCell] === 0
        ? selectedCell
        : emptyIndices[0];

    haptic.success();
    setHintsLeft((h) => h - 1);
    setHintsUsed((h) => h + 1);
    setSelectedCell(target);

    const next = [...board];
    next[target] = solution[target];
    setBoard(next);
    setErrors(computeErrors(next, solution));

    const won = next.every((v, i) => v === solution[i]);
    if (won && !solvedRef.current) {
      solvedRef.current = true;
      const usedAfter = hintsUsed + 1;
      const finalScore = Math.max(500, 5000 - elapsedSeconds * 8 - usedAfter * 200);
      const update = updateProgress("sudoku", finalScore, { won: true });
      setResult(update);
      setPhase("over");
    }
  }, [
    phase,
    hintsLeft,
    board,
    clues,
    solution,
    selectedCell,
    elapsedSeconds,
    hintsUsed,
    haptic,
    updateProgress,
  ]);

  // ── Border widths for 3×3 box lines ─────────────────────────────────────
  const getCellBorderRight = (idx: number): number => {
    const col = getCol(idx);
    if (col === 8) return 0;
    if (col === 2 || col === 5) return 2;
    return 0.5;
  };

  const getCellBorderBottom = (idx: number): number => {
    const row = getRow(idx);
    if (row === 8) return 0;
    if (row === 2 || row === 5) return 2;
    return 0.5;
  };

  // ── Difficulty helpers ───────────────────────────────────────────────────
  const diffLabel = (d: Difficulty): string => {
    if (d === "easy") return t("sdkEasy");
    if (d === "medium") return t("sdkMedium");
    return t("sdkHard");
  };

  const diffColor = (d: Difficulty): string => {
    if (d === "easy") return "#22c55e";
    if (d === "medium") return "#f59e0b";
    return "#ef4444";
  };

  // =========================================================================
  // RENDER: Idle
  // =========================================================================

  if (phase === "idle") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.idleTitle, { color: theme.text }]}>
          {t("gameSudokuName")}
        </Text>
        <Text style={[styles.idleDesc, { color: theme.mutedText }]}>
          {t("gameSudokuDescription")}
        </Text>
        <Pressable
          style={[styles.startBtn, { backgroundColor: theme.tint }]}
          onPress={() => {
            haptic.tap();
            setPhase("selecting");
          }}
        >
          <Text style={styles.startBtnText}>{t("gameTapToStart")}</Text>
        </Pressable>
      </View>
    );
  }

  // =========================================================================
  // RENDER: Difficulty selection
  // =========================================================================

  if (phase === "selecting") {
    const difficulties: Difficulty[] = ["easy", "medium", "hard"];
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.selectTitle, { color: theme.text }]}>
          {t("sdkSelectDifficulty")}
        </Text>
        <RNView style={styles.diffRow}>
          {difficulties.map((d) => (
            <Pressable
              key={d}
              style={[
                styles.diffBtn,
                {
                  backgroundColor: theme.card,
                  borderColor: diffColor(d),
                  borderWidth: 2,
                },
              ]}
              onPress={() => startDifficulty(d)}
            >
              <Text style={[styles.diffBtnLabel, { color: diffColor(d) }]}>
                {diffLabel(d)}
              </Text>
              <Text style={[styles.diffBtnSub, { color: theme.mutedText }]}>
                {d === "easy" ? "~10 min" : d === "medium" ? "~20 min" : "~30 min"}
              </Text>
            </Pressable>
          ))}
        </RNView>
        <Pressable
          onPress={() => {
            haptic.tap();
            setPhase("idle");
          }}
        >
          <Text style={[styles.backLink, { color: theme.mutedText }]}>
            {t("gameQuit")}
          </Text>
        </Pressable>
      </View>
    );
  }

  // =========================================================================
  // RENDER: Playing / Paused / Over
  // =========================================================================

  const isInteractive = phase === "playing";

  return (
    <View style={[styles.playContainer, { backgroundColor: theme.background }]}>
      {/* ── HUD ── */}
      <RNView style={styles.hudRow}>
        {selectedDifficulty !== null ? (
          <RNView
            style={[
              styles.diffChip,
              {
                backgroundColor: diffColor(selectedDifficulty) + "22",
                borderColor: diffColor(selectedDifficulty),
              },
            ]}
          >
            <Text
              style={[
                styles.diffChipText,
                { color: diffColor(selectedDifficulty) },
              ]}
            >
              {diffLabel(selectedDifficulty)}
            </Text>
          </RNView>
        ) : null}

        <RNView style={styles.hudRight}>
          <RNView
            style={[
              styles.hudStat,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.hudStatLabel, { color: theme.mutedText }]}>
              {t("sdkTime")}
            </Text>
            <Text style={[styles.hudStatValue, { color: theme.text }]}>
              {formatTime(elapsedSeconds)}
            </Text>
          </RNView>

          <RNView
            style={[
              styles.hudStat,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.hudStatLabel, { color: theme.mutedText }]}>
              {t("sdkHints")}
            </Text>
            <Text style={[styles.hudStatValue, { color: theme.text }]}>
              {hintsLeft}/3
            </Text>
          </RNView>

          <GameControls
            onPause={handlePause}
            onReset={resetToIdle}
            isPaused={phase === "paused"}
          />
        </RNView>
      </RNView>

      {/* ── Grid ── */}
      <Animated.View
        style={[
          styles.grid,
          {
            width: cellSize * 9,
            borderColor: theme.text,
            borderTopWidth: 2,
            borderLeftWidth: 2,
            transform: [{ translateX: gridShake }],
          },
        ]}
      >
        {board.map((value, idx) => {
          const isClue = clues[idx] !== 0;
          const isError = errors.has(idx);
          const isSelected = selectedCell === idx;
          const isPeerCell =
            selectedCell !== null && selectedCell !== idx && isPeer(selectedCell, idx);
          const isMatchingNumber =
            selectedCell !== null &&
            value !== 0 &&
            board[selectedCell] !== 0 &&
            value === board[selectedCell] &&
            idx !== selectedCell;

          let cellBg = theme.background;
          if (isSelected) {
            cellBg = theme.tint + "44";
          } else if (isMatchingNumber) {
            cellBg = theme.tint + "22";
          } else if (isPeerCell) {
            cellBg = theme.surface;
          }

          let textColor = theme.text;
          if (isError) {
            textColor = "#ef4444";
          } else if (!isClue && value !== 0) {
            textColor = theme.tint;
          }

          const borderRightWidth = getCellBorderRight(idx);
          const borderBottomWidth = getCellBorderBottom(idx);

          return (
            <AnimatedPressable
              key={idx}
              onPress={() => handleCellPress(idx)}
              disabled={isClue || !isInteractive}
              style={{
                width: cellSize,
                height: cellSize,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cellBg,
                borderRightWidth,
                borderBottomWidth,
                borderRightColor:
                  borderRightWidth === 2 ? theme.text : theme.border,
                borderBottomColor:
                  borderBottomWidth === 2 ? theme.text : theme.border,
                transform: isSelected ? [{ scale: selectPulse }] : undefined,
              }}
            >
              {value !== 0 ? (
                <Text
                  style={{
                    fontSize: cellSize > 38 ? FontSize.md : FontSize.sm,
                    fontWeight: isClue ? FontWeight.black : FontWeight.bold,
                    color: textColor,
                  }}
                >
                  {value}
                </Text>
              ) : null}
            </AnimatedPressable>
          );
        })}
      </Animated.View>

      {/* ── Numpad ── */}
      <RNView style={styles.numpad}>
        {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => (
          <BouncyPressable
            key={n}
            onPress={() => handleNumberInput(n)}
            disabled={!isInteractive || selectedCell === null}
            style={[
              styles.numBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: !isInteractive || selectedCell === null ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.numBtnText, { color: theme.text }]}>{n}</Text>
          </BouncyPressable>
        ))}

        {/* Erase button */}
        <BouncyPressable
          onPress={handleErase}
          disabled={!isInteractive || selectedCell === null}
          style={[
            styles.numBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: !isInteractive || selectedCell === null ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[styles.numBtnText, { color: theme.mutedText }]}>✕</Text>
        </BouncyPressable>
      </RNView>

      {/* ── Hint button ── */}
      <Pressable
        onPress={handleHint}
        disabled={!isInteractive || hintsLeft <= 0}
        style={[
          styles.hintBtn,
          {
            backgroundColor: hintsLeft > 0 ? theme.tint + "18" : theme.surface,
            borderColor: hintsLeft > 0 ? theme.tint : theme.border,
            opacity: !isInteractive || hintsLeft <= 0 ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.hintBtnText,
            { color: hintsLeft > 0 ? theme.tint : theme.mutedText },
          ]}
        >
          {t("sdkHints")} ({hintsLeft} {t("sdkHintsLeft")})
        </Text>
      </Pressable>

      {/* ── Pause overlay ── */}
      <GamePauseOverlay
        visible={phase === "paused"}
        onResume={handleResume}
        onRestart={resetToIdle}
      />

      {/* ── Result overlay ── */}
      {phase === "over" && result !== null ? (
        <GameResult
          title={t("sdkCongrats")}
          score={Math.max(500, 5000 - elapsedSeconds * 8 - hintsUsed * 200)}
          best={result.best}
          last={result.last !== Math.max(500, 5000 - elapsedSeconds * 8 - hintsUsed * 200) ? result.last : undefined}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          isNewBest={result.isNewBest}
          onPlayAgain={resetToIdle}
          subtitle={
            selectedDifficulty !== null
              ? `${formatTime(elapsedSeconds)} · ${diffLabel(selectedDifficulty)}`
              : formatTime(elapsedSeconds)
          }
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ── Idle / Select ──────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
  },
  idleTitle: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    letterSpacing: 1,
    textAlign: "center",
  },
  idleDesc: {
    fontSize: FontSize.base,
    textAlign: "center",
    lineHeight: FontSize.base * 1.5,
    maxWidth: 280,
  },
  startBtn: {
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.button,
    marginTop: Spacing.sm,
  },
  startBtnText: {
    ...TextStyle.buttonPrimary,
    color: "#fff",
  },
  selectTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  diffRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  diffBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.card,
    gap: Spacing.xs,
    minWidth: 88,
  },
  diffBtnLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
  },
  diffBtnSub: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  backLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },

  // ── Playing ────────────────────────────────────────────────────────────
  playContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  hudRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  hudRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    justifyContent: "flex-end",
  },
  diffChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  diffChipText: {
    ...TextStyle.chipLabel,
    textTransform: "uppercase",
  },
  hudStat: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 56,
  },
  hudStatLabel: {
    ...TextStyle.statLabel,
  },
  hudStatValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  numBtn: {
    width: 40,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  numBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  hintBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.button,
    borderWidth: 1.5,
  },
  hintBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
});
