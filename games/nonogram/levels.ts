// ─── Sky Pixels (nonogram) — hardcoded levels ────────────────────────────────
//
// Each solution is a size×size pixel picture: "#" = filled, "." = empty.
// EVERY level is solvable by pure line logic (no guessing) — verified by
// `solveByLineLogic` in __tests__/nonogramLogic.test.ts, which also proves
// each solution is unique. Keep that test green when editing pixels.

export type NonogramLevel = {
	id: number;
	size: number;
	solution: string[];
};

export const NONOGRAM_LEVELS: NonogramLevel[] = [
	// ── 5×5 ──
	{
		// Heart
		id: 1,
		size: 5,
		solution: [
			".#.#.",
			"#####",
			"#####",
			".###.",
			"..#..",
		],
	},
	{
		// Plane
		id: 2,
		size: 5,
		solution: [
			"..#..",
			"..#..",
			"#####",
			"..#..",
			".###.",
		],
	},
	{
		// Arrow up (take-off)
		id: 3,
		size: 5,
		solution: [
			"..#..",
			".###.",
			"#####",
			"..#..",
			"..#..",
		],
	},
	{
		// Suitcase
		id: 4,
		size: 5,
		solution: [
			".###.",
			".#.#.",
			"#####",
			"#####",
			"#####",
		],
	},
	// ── 8×8 ──
	{
		// Cloud
		id: 5,
		size: 8,
		solution: [
			"........",
			"...##...",
			"..####..",
			".######.",
			"########",
			"########",
			"........",
			"........",
		],
	},
	{
		// Coffee cup with steam
		id: 6,
		size: 8,
		solution: [
			"..#..#..",
			".#..#...",
			"..#..#..",
			"######..",
			"#####.#.",
			"#####.#.",
			"######..",
			".####...",
		],
	},
	{
		// Shooting star
		id: 7,
		size: 8,
		solution: [
			"...##...",
			"...##...",
			".######.",
			"########",
			".######.",
			"..####..",
			".##..##.",
			"##....##",
		],
	},
	// ── 10×10 ──
	{
		// Headphones
		id: 8,
		size: 10,
		solution: [
			"...####...",
			"..######..",
			".##....##.",
			".#......#.",
			"##......##",
			"##......##",
			"###....###",
			"###....###",
			"###....###",
			".##....##.",
		],
	},
	{
		// Airliner
		id: 9,
		size: 10,
		solution: [
			".....#....",
			".....##...",
			".....###..",
			"##########",
			"##########",
			".....###..",
			".....##...",
			".....#....",
			"....###...",
			"...#####..",
		],
	},
	{
		// Hot-air balloon
		id: 10,
		size: 10,
		solution: [
			"...####...",
			"..######..",
			".########.",
			".########.",
			".########.",
			"..######..",
			"...#..#...",
			"...#..#...",
			"...####...",
			"...####...",
		],
	},
];

export function getNonogramLevel(id: number): NonogramLevel | undefined {
	return NONOGRAM_LEVELS.find((level) => level.id === id);
}
