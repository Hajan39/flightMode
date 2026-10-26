import { leftForeground, shiftDeadline } from "@/hooks/useAutoPause";

describe("leftForeground", () => {
  it("pauses when an active app goes to the background or inactive", () => {
    expect(leftForeground("active", "background")).toBe(true);
    expect(leftForeground("active", "inactive")).toBe(true);
  });

  it("pauses on any transition into the background", () => {
    // iOS: enabled while `inactive`, then the app is backgrounded.
    expect(leftForeground("inactive", "background")).toBe(true);
    expect(leftForeground("unknown", "background")).toBe(true);
    expect(leftForeground("extension", "background")).toBe(true);
    expect(leftForeground(null, "background")).toBe(true);
    expect(leftForeground(undefined, "background")).toBe(true);
  });

  it("ignores every other transition", () => {
    expect(leftForeground("active", "active")).toBe(false);
    expect(leftForeground("background", "active")).toBe(false);
    expect(leftForeground("inactive", "active")).toBe(false);
    expect(leftForeground("background", "background")).toBe(false);
    expect(leftForeground("background", "inactive")).toBe(false);
    expect(leftForeground(undefined, "inactive")).toBe(false);
    expect(leftForeground("active", "unknown")).toBe(false);
    expect(leftForeground("active", "extension")).toBe(false);
  });
});

describe("shiftDeadline", () => {
  it("pushes a running deadline back by the paused time", () => {
    expect(shiftDeadline(10_000, 2500)).toBe(12_500);
  });

  it("keeps 'off' (0) off and ignores empty pauses", () => {
    expect(shiftDeadline(0, 5000)).toBe(0);
    expect(shiftDeadline(10_000, 0)).toBe(10_000);
    expect(shiftDeadline(10_000, -100)).toBe(10_000);
  });
});
