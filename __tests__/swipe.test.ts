import { swipeDirection } from "@/hooks/useSwipe";

describe("swipeDirection", () => {
  it("ignores short drags (taps)", () => {
    expect(swipeDirection(10, -12)).toBeNull();
  });

  it("picks the dominant axis", () => {
    expect(swipeDirection(80, 20)).toBe("right");
    expect(swipeDirection(-80, 30)).toBe("left");
    expect(swipeDirection(10, 60)).toBe("down");
    expect(swipeDirection(-20, -60)).toBe("up");
  });
});
