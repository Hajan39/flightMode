import { ACHIEVEMENT_GRID, getGridLayout } from "@/components/gridLayout";

// Profile content has 16 dp padding on each side.
const contentWidth = (screen: number) => screen - 32;

describe("achievement grid layout", () => {
  test.each([320, 360, 393, 412, 430, 600, 768, 1024, 1280])(
    "fills the row exactly at %i dp without overflowing",
    (screen) => {
      const width = contentWidth(screen);
      const { columns, itemWidth } = getGridLayout(width, ACHIEVEMENT_GRID);
      const used = columns * itemWidth + (columns - 1) * ACHIEVEMENT_GRID.gap;
      expect(used).toBeLessThanOrEqual(width);
      expect(width - used).toBeLessThan(0.1);
      expect(columns).toBeGreaterThanOrEqual(ACHIEVEMENT_GRID.minColumns);
      expect(columns).toBeLessThanOrEqual(ACHIEVEMENT_GRID.maxColumns);
    }
  );

  test("phones get 2 columns, tablets more", () => {
    expect(getGridLayout(contentWidth(320), ACHIEVEMENT_GRID).columns).toBe(2);
    expect(getGridLayout(contentWidth(430), ACHIEVEMENT_GRID).columns).toBe(2);
    expect(getGridLayout(contentWidth(768), ACHIEVEMENT_GRID).columns).toBe(4);
    expect(getGridLayout(contentWidth(1280), ACHIEVEMENT_GRID).columns).toBe(5);
  });

  test("degenerate widths stay safe", () => {
    expect(getGridLayout(0, ACHIEVEMENT_GRID).itemWidth).toBe(0);
    expect(getGridLayout(Number.NaN, ACHIEVEMENT_GRID).columns).toBe(2);
  });
});
