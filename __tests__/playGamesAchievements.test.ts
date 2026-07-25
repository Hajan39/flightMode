import { achievements } from "@/data/achievements";
import {
	playGamesAchievementIds,
	getPlayGamesAchievementId,
} from "@/data/playGamesAchievements";

const localIds = new Set(achievements.map((a) => a.id));
const mapIds = new Set(Object.keys(playGamesAchievementIds));

describe("Play Games achievement mapping integrity", () => {
	test("every local achievement has a mapping entry", () => {
		const missing = [...localIds].filter((id) => !mapIds.has(id));
		expect(missing).toEqual([]);
	});

	test("the map has no stale entries for removed achievements", () => {
		const stale = [...mapIds].filter((id) => !localIds.has(id));
		expect(stale).toEqual([]);
	});

	test("mapped values are either null or a non-empty CgkI-style id", () => {
		for (const [id, playId] of Object.entries(playGamesAchievementIds)) {
			if (playId === null) continue;
			expect(typeof playId).toBe("string");
			expect((playId as string).length).toBeGreaterThan(0);
			// Not a hard requirement of Play, but every real id we've seen begins
			// with "CgkI" — catches accidental placeholder/typo values.
			expect(playId).toMatch(/^CgkI/);
		}
	});

	test("getPlayGamesAchievementId returns null for unknown ids", () => {
		expect(getPlayGamesAchievementId("does-not-exist")).toBeNull();
	});
});
