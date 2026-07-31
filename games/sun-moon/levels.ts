// Hardcoded Sun & Moon (Takuzu) levels. Generated offline with a seeded
// backtracking generator: build a valid full grid, then greedily blank cells
// while the puzzle keeps EXACTLY one solution (verified by countSolutions in
// logic.ts and __tests__/sunMoonLogic.test.ts).
//
// solution rows use "S" (sun) / "M" (moon); givens rows additionally use "."
// for blanks the player must fill. Givens are a subset of the solution.

export type SunMoonLevel = {
	id: number;
	size: number;
	solution: string[];
	givens: string[];
};

export const LEVELS: SunMoonLevel[] = [
	{
		id: 1,
		size: 4,
		solution: [
			"MMSS",
			"SSMM",
			"MMSS",
			"SSMM",
		],
		givens: [
			"..SS",
			"S..M",
			"M.SS",
			"...M",
		],
	},
	{
		id: 2,
		size: 4,
		solution: [
			"MSMS",
			"SSMM",
			"SMSM",
			"MMSS",
		],
		givens: [
			"M..S",
			"S..M",
			".M.M",
			"..S.",
		],
	},
	{
		id: 3,
		size: 4,
		solution: [
			"MSSM",
			"MMSS",
			"SSMM",
			"SMMS",
		],
		givens: [
			".S.M",
			".M..",
			"SS..",
			"S...",
		],
	},
	{
		id: 4,
		size: 4,
		solution: [
			"SMMS",
			"MSSM",
			"SMMS",
			"MSSM",
		],
		givens: [
			"....",
			"M..M",
			"...S",
			"M..M",
		],
	},
	{
		id: 5,
		size: 6,
		solution: [
			"SSMSMM",
			"MMSSMS",
			"SSMMSM",
			"SSMMSM",
			"MMSSMS",
			"MMSMSS",
		],
		givens: [
			"..MS..",
			".M....",
			"..MMSM",
			"..MM..",
			"MM.S..",
			"MMS.S.",
		],
	},
	{
		id: 6,
		size: 6,
		solution: [
			"MSMSMS",
			"MMSSMS",
			"SSMMSM",
			"MSMSMS",
			"SMSMSM",
			"SMSMSM",
		],
		givens: [
			".S...S",
			"MM..M.",
			".S....",
			".SM..S",
			".M..S.",
			"...MSM",
		],
	},
	{
		id: 7,
		size: 6,
		solution: [
			"MMSSMS",
			"SSMSMM",
			"SMSMSM",
			"MSMMSS",
			"MMSSMS",
			"SSMMSM",
		],
		givens: [
			"...SM.",
			"..M.MM",
			"S.S...",
			"......",
			".MS.M.",
			"SS....",
		],
	},
	{
		id: 8,
		size: 6,
		solution: [
			"MMSSMS",
			"SSMSMM",
			"SSMMSM",
			"MMSSMS",
			"MSMMSS",
			"SMSMSM",
		],
		givens: [
			".M....",
			"S.....",
			"..MMSM",
			"......",
			"....S.",
			"SM..S.",
		],
	},
	{
		id: 9,
		size: 8,
		solution: [
			"SMMSSMSM",
			"MSSMMSMS",
			"MSMSSMMS",
			"SMMSMSSM",
			"MMSMSSMS",
			"SSMSMMSM",
			"MSSMMSSM",
			"SMSMSMMS",
		],
		givens: [
			"S..S....",
			"MS.MMSM.",
			"..M..M.S",
			".M.....M",
			"MM.MSS..",
			".S.S....",
			"M..M....",
			".M.M.MM.",
		],
	},
	{
		id: 10,
		size: 8,
		solution: [
			"SSMSMMSM",
			"MSSMSSMM",
			"SMMSMSMS",
			"SMSMSMSM",
			"MSSMMSMS",
			"MSMSMMSS",
			"SMMSSMSM",
			"MMSMSSMS",
		],
		givens: [
			"S.M.MM..",
			"..S...M.",
			"SM......",
			"SMS..MS.",
			"......MS",
			"M.M.MM..",
			"S.MS....",
			".....S.S",
		],
	},
	{
		id: 11,
		size: 8,
		solution: [
			"SSMSMMSM",
			"SMMSMSMS",
			"MSSMSMMS",
			"SSMSMMSM",
			"MMSMSSMS",
			"SMSMMSSM",
			"MSMSSMSM",
			"MMSMSSMS",
		],
		givens: [
			"..M..M..",
			"..M....S",
			"M...SM..",
			"S..S...M",
			"MMS.....",
			"S...M.S.",
			"M..S.M.M",
			"....S.M.",
		],
	},
	{
		id: 12,
		size: 8,
		solution: [
			"SMMSMMSS",
			"SSMMSMMS",
			"MSSMSSMM",
			"MMSSMSSM",
			"SSMMSMMS",
			"MSSMMSMS",
			"MMSSMSSM",
			"SMMSSMSM",
		],
		givens: [
			"..MS....",
			"S.......",
			"MS....MM",
			".MS..S.M",
			"...M.M..",
			".S......",
			"....M..M",
			"S..SS..M",
		],
	},
];
