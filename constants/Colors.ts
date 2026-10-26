const tintColorLight = "#2f95dc";
const tintColorDark = "#7cc7ff";
const tintColorCrazy = "#d1007f";

/**
 * Theme palettes. Semantic status tokens (every palette defines all of them;
 * contrast is enforced by `__tests__/themeContrast.test.ts`):
 * - `success` / `danger` / `info` / `warningText` — text or icon on
 *   `background` / `card` / `surface` / `elevated` (AA, >= 4.5:1).
 * - `success` / `danger` / `warning` also work as fills; put text on them with
 *   `onSuccess` / `onDanger` / `onWarning` (AA). `warning` itself is a fill /
 *   icon color — use `warningText` for amber text.
 * - `onTint` — text on a `tint` fill.
 */
export default {
  crazy: {
    accentSoft: "#3d0070",
    background: "#1a0033",
    border: "#7b2fff",
    card: "#2d0057",
    danger: "#ff5d8f",
    dangerBorder: "#ff4d7d",
    dangerSurface: "#3d0a1f",
    elevated: "#420080",
    headerBackground: "#1a0033",
    info: "#4fd8ff",
    inputBackground: "#250045",
    mutedText: "#c9a0ff",
    onDanger: "#1a0010",
    onSuccess: "#001a0a",
    onTint: "#ffffff",
    onWarning: "#1a1200",
    progressTrack: "#4a1a7a",
    success: "#39ff7f",
    successBorder: "#39ff7f",
    successSurface: "#1a3d2a",
    surface: "#3a006e",
    tabIconDefault: "#b06cff",
    tabIconSelected: tintColorCrazy,
    text: "#ffffff",
    tint: tintColorCrazy,
    warning: "#ffe135",
    warningText: "#ffe135",
  },
  dark: {
    accentSoft: "#10283c",
    background: "#091017",
    border: "#263746",
    card: "#101b25",
    danger: "#f05f5c",
    dangerBorder: "#cc4b5a",
    dangerSurface: "#4d1f24",
    elevated: "#1a2833",
    headerBackground: "#0d1720",
    info: "#7cc7ff",
    inputBackground: "#13202a",
    mutedText: "#98a8b6",
    onDanger: "#1a0507",
    onSuccess: "#06121e",
    onTint: "#06121e",
    onWarning: "#1a1200",
    progressTrack: "#223242",
    success: "#5cc97b",
    successBorder: "#4da96b",
    successSurface: "#163225",
    surface: "#16232e",
    tabIconDefault: "#6e7d88",
    tabIconSelected: tintColorDark,
    text: "#f3f7fa",
    tint: tintColorDark,
    warning: "#ffcc66",
    warningText: "#ffcc66",
  },
  light: {
    accentSoft: "#e8f4ff",
    background: "#ffffff",
    border: "#d9e3ea",
    card: "#f3f7fb",
    danger: "#c62828",
    dangerBorder: "#e5484d",
    dangerSurface: "#fdecea",
    elevated: "#ffffff",
    headerBackground: "#ffffff",
    info: "#0273b8",
    inputBackground: "#ffffff",
    mutedText: "#5f6b76",
    onDanger: "#ffffff",
    onSuccess: "#ffffff",
    onTint: "#ffffff",
    onWarning: "#1a1200",
    progressTrack: "#d8e2ea",
    success: "#2e7d32",
    successBorder: "#58a96b",
    successSurface: "#e7f6ea",
    surface: "#eef4f8",
    tabIconDefault: "#7d8790",
    tabIconSelected: tintColorLight,
    text: "#11181c",
    tint: tintColorLight,
    warning: "#f5a623",
    warningText: "#9a5b00",
  },
  // ── FlightMode Plus themes (dark-based; Themed overrides fall back to `dark`) ──
  midnight: {
    accentSoft: "#0f1a2e",
    background: "#000000",
    border: "#24242e",
    card: "#0b0b0f",
    danger: "#ff6b6b",
    dangerBorder: "#e5484d",
    dangerSurface: "#2a0f12",
    elevated: "#16161d",
    headerBackground: "#000000",
    info: "#8ab4ff",
    inputBackground: "#0e0e13",
    mutedText: "#9a9aa8",
    onDanger: "#1a0507",
    onSuccess: "#000814",
    onTint: "#000814",
    onWarning: "#1a1200",
    progressTrack: "#1e1e26",
    success: "#5cc97b",
    successBorder: "#4da96b",
    successSurface: "#0f2a1c",
    surface: "#121218",
    tabIconDefault: "#6b6b78",
    tabIconSelected: "#8ab4ff",
    text: "#f5f5f7",
    tint: "#8ab4ff",
    warning: "#ffcc66",
    warningText: "#ffcc66",
  },
  sunset: {
    accentSoft: "#3d2019",
    background: "#1c1012",
    border: "#5a3036",
    card: "#2a171a",
    danger: "#ff6b81",
    dangerBorder: "#ff4d6d",
    dangerSurface: "#3d1218",
    elevated: "#3a2024",
    headerBackground: "#1c1012",
    info: "#7cc7ff",
    inputBackground: "#24141a",
    mutedText: "#e0b9a8",
    onDanger: "#2a0e05",
    onSuccess: "#0a1a0f",
    onTint: "#2a0e05",
    onWarning: "#2a1a00",
    progressTrack: "#4a2a2e",
    success: "#6fd08c",
    successBorder: "#5fbf7a",
    successSurface: "#1f3324",
    surface: "#331c20",
    tabIconDefault: "#b08478",
    tabIconSelected: "#ff8a5b",
    text: "#fff3ea",
    tint: "#ff8a5b",
    warning: "#ffd166",
    warningText: "#ffd166",
  },
};

/**
 * Seat colors for pass-and-play / shared-screen games. Index = seat; seat 0 is
 * the device owner ("host"). Shared by every multiplayer game so a player keeps
 * the same color from setup to leaderboard.
 */
export const PlayerColors = [
  "#4FC3F7",
  "#FF8A65",
  "#81C784",
  "#CE93D8",
  "#FFD54F",
  "#4DD0E1",
] as const;

export const MAX_MATCH_PLAYERS = PlayerColors.length;

/**
 * Text on a `PlayerColors` fill (all seat colors are light pastels, so one
 * dark ink works in every theme).
 */
export const OnPlayerColor = "#0b1620";

/**
 * Minesweeper adjacency-number colors (index = mine count − 1), per base
 * scheme — they sit on the theme `background`. Plus themes use `dark`.
 */
export const MineNumberColors: Record<
  "light" | "dark" | "crazy",
  readonly string[]
> = {
  crazy: [
    "#4fd8ff",
    "#39ff7f",
    "#ff7fa8",
    "#d0b0ff",
    "#ff9ef0",
    "#5ff5e0",
    "#ffffff",
    "#c0c0d8",
  ],
  dark: [
    "#64b5f6",
    "#81c784",
    "#ef9a9a",
    "#b39ddb",
    "#f48fb1",
    "#4db6ac",
    "#e0e0e0",
    "#a0a0a0",
  ],
  light: [
    "#1565c0",
    "#2e7d32",
    "#c62828",
    "#4527a0",
    "#ad1457",
    "#00695c",
    "#212121",
    "#616161",
  ],
};

/**
 * 2048 tile art — `[background, text]`, the same in every theme (the tiles
 * carry their own background). Text is the dark ink wherever the classic
 * white numerals fell below 3:1 (tile numbers are large bold text).
 */
export const Tile2048Colors: Readonly<
  Record<number, readonly [string, string]>
> = {
  2: ["#eee4da", "#776e65"],
  4: ["#ede0c8", "#776e65"],
  8: ["#f2b179", "#3c3a32"],
  16: ["#f59563", "#3c3a32"],
  32: ["#f67c5f", "#3c3a32"],
  64: ["#f65e3b", "#3c3a32"],
  128: ["#edcf72", "#3c3a32"],
  256: ["#edcc61", "#3c3a32"],
  512: ["#edc850", "#3c3a32"],
  1024: ["#edc53f", "#3c3a32"],
  2048: ["#edc22e", "#3c3a32"],
};

/** 2048 tiles above 2048. */
export const Tile2048High: readonly [string, string] = ["#3c3a32", "#ffffff"];
