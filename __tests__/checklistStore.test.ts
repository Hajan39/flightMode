import { checklistSections, defaultItemIds } from "@/data/checklist";
import { en } from "@/i18n/locales/en";
import { useAchievementStore } from "@/store/useAchievementStore";
import {
	getChecklistProgress,
	isChecklistComplete,
	MAX_CUSTOM_ITEM_LENGTH,
	useChecklistStore,
} from "@/store/useChecklistStore";

const enKeys = new Set(Object.keys(en));

function reset() {
	useChecklistStore.setState({
		flightId: "f1",
		checkedIds: [],
		customItems: [],
		completedFlightId: null,
	});
	useAchievementStore.setState({ checklistsCompleted: 0, unlockedIds: [], newUnlockedIds: [] });
}

describe("checklist templates", () => {
	test("has 5 sections with unique item ids", () => {
		expect(checklistSections).toHaveLength(5);
		expect(new Set(defaultItemIds).size).toBe(defaultItemIds.length);
		expect(defaultItemIds.length).toBeGreaterThanOrEqual(25);
	});

	test("every title/label key exists in en", () => {
		for (const section of checklistSections) {
			expect(enKeys.has(section.titleKey)).toBe(true);
			expect(section.icon.length).toBeGreaterThan(0);
			for (const item of section.items) {
				expect(enKeys.has(item.labelKey)).toBe(true);
			}
		}
	});
});

describe("useChecklistStore", () => {
	beforeEach(reset);

	test("toggle checks and unchecks", () => {
		const store = useChecklistStore.getState();
		store.toggleItem("doc-passport");
		expect(useChecklistStore.getState().checkedIds).toContain("doc-passport");
		useChecklistStore.getState().toggleItem("doc-passport");
		expect(useChecklistStore.getState().checkedIds).not.toContain("doc-passport");
	});

	test("addCustomItem trims, ignores empty and caps length", () => {
		useChecklistStore.getState().addCustomItem("carryOn", "   ");
		expect(useChecklistStore.getState().customItems).toHaveLength(0);
		useChecklistStore.getState().addCustomItem("carryOn", "  Sunglasses  ");
		expect(useChecklistStore.getState().customItems[0].label).toBe("Sunglasses");
		useChecklistStore.getState().addCustomItem("carryOn", "x".repeat(200));
		expect(useChecklistStore.getState().customItems[1].label).toHaveLength(
			MAX_CUSTOM_ITEM_LENGTH,
		);
	});

	test("removeCustomItem also clears its tick", () => {
		useChecklistStore.getState().addCustomItem("documents", "Vaccination card");
		const id = useChecklistStore.getState().customItems[0].id;
		useChecklistStore.getState().toggleItem(id);
		expect(useChecklistStore.getState().checkedIds).toContain(id);
		useChecklistStore.getState().removeCustomItem(id);
		expect(useChecklistStore.getState().customItems).toHaveLength(0);
		expect(useChecklistStore.getState().checkedIds).not.toContain(id);
	});

	test("resetForFlight clears ticks and completion but keeps custom items", () => {
		useChecklistStore.getState().addCustomItem("carryOn", "Kindle");
		useChecklistStore.getState().toggleItem("co-pen");
		useChecklistStore.setState({ completedFlightId: "f1" });
		useChecklistStore.getState().resetForFlight("f2", "new_flight");
		const s = useChecklistStore.getState();
		expect(s.flightId).toBe("f2");
		expect(s.checkedIds).toEqual([]);
		expect(s.completedFlightId).toBeNull();
		expect(s.customItems).toHaveLength(1);
	});

	test("progress counts defaults + customs", () => {
		useChecklistStore.getState().addCustomItem("carryOn", "Kindle");
		useChecklistStore.getState().toggleItem("co-pen");
		const s = useChecklistStore.getState();
		expect(getChecklistProgress(s)).toEqual({
			done: 1,
			total: defaultItemIds.length + 1,
		});
		expect(isChecklistComplete(s)).toBe(false);
	});

	test("completing every item increments the achievement counter exactly once per flight", () => {
		for (const id of defaultItemIds) useChecklistStore.getState().toggleItem(id);
		expect(isChecklistComplete(useChecklistStore.getState())).toBe(true);
		expect(useAchievementStore.getState().checklistsCompleted).toBe(1);
		// Untick + retick must not double count for the same flight.
		useChecklistStore.getState().toggleItem(defaultItemIds[0]);
		useChecklistStore.getState().toggleItem(defaultItemIds[0]);
		expect(useAchievementStore.getState().checklistsCompleted).toBe(1);
		// A new flight can be completed again.
		useChecklistStore.getState().resetForFlight("f2", "new_flight");
		for (const id of defaultItemIds) useChecklistStore.getState().toggleItem(id);
		expect(useAchievementStore.getState().checklistsCompleted).toBe(2);
	});
});
