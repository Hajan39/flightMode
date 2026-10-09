import {
  applyGust,
  type BallState,
  DEFAULT_PHYSICS,
  deviceToScreenTilt,
  distanceFromCenter,
  gustIntervalMs,
  gustStrength,
  isOutOfBounds,
  ringRadius,
  START_STATE,
  scoreTurn,
  step,
} from "@/games/tilt-balance/logic";

describe("step", () => {
  test("a level phone leaves a resting ball where it is", () => {
    const next = step(START_STATE, 0, 0, 16);
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  test("tilt accelerates the ball in that direction", () => {
    let state = START_STATE;
    for (let i = 0; i < 30; i += 1) {
      state = step(state, 1, 0, 16);
    }
    expect(state.x).toBeGreaterThan(0);
    expect(state.vx).toBeGreaterThan(0);
    expect(state.y).toBe(0);

    let up = START_STATE;
    for (let i = 0; i < 30; i += 1) {
      up = step(up, 0, -1, 16);
    }
    expect(up.y).toBeLessThan(0);
  });

  test("damping slows a moving ball when the phone is level", () => {
    const moving: BallState = { vx: 1, vy: 0, x: 0, y: 0 };
    const next = step(moving, 0, 0, 100);
    expect(next.vx).toBeLessThan(moving.vx);
    expect(next.vx).toBeGreaterThan(0);
  });

  test("a stalled frame is clamped to maxStepMs so the ball can't teleport", () => {
    const moving: BallState = { vx: 1, vy: 0, x: 0, y: 0 };
    const clamped = step(moving, 0, 0, 5000);
    const atCap = step(moving, 0, 0, DEFAULT_PHYSICS.maxStepMs);
    expect(clamped).toEqual(atCap);
    expect(clamped.x).toBeLessThan(0.1);
  });

  test("a zero-length frame is a no-op", () => {
    const moving: BallState = { vx: 1, vy: -1, x: 0.2, y: 0.1 };
    expect(step(moving, 1, 1, 0)).toBe(moving);
  });
});

describe("gusts", () => {
  test("a gust only changes velocity, never position", () => {
    const gusted = applyGust({ vx: 0, vy: 0, x: 0.1, y: 0.2 }, 0.5, () => 0);
    expect(gusted.x).toBe(0.1);
    expect(gusted.y).toBe(0.2);
    expect(Math.hypot(gusted.vx, gusted.vy)).toBeCloseTo(0.5);
  });

  test("gusts get stronger and more frequent over time", () => {
    expect(gustStrength(30_000)).toBeGreaterThan(gustStrength(0));
    expect(gustIntervalMs(30_000)).toBeLessThan(gustIntervalMs(0));
    expect(gustIntervalMs(600_000)).toBeGreaterThanOrEqual(1600);
    expect(gustStrength(600_000)).toBeLessThanOrEqual(1);
  });
});

describe("ring and bounds", () => {
  test("the ring shrinks but never collapses", () => {
    expect(ringRadius(0)).toBeCloseTo(0.55);
    expect(ringRadius(45_000)).toBeCloseTo(0.3);
    expect(ringRadius(600_000)).toBeCloseTo(0.3);
    expect(ringRadius(20_000)).toBeLessThan(ringRadius(0));
  });

  test("the ball is lost only at the edge of the plate", () => {
    expect(isOutOfBounds({ vx: 0, vy: 0, x: 0.9, y: 0 })).toBe(false);
    expect(isOutOfBounds({ vx: 0, vy: 0, x: 1, y: 0 })).toBe(true);
    expect(isOutOfBounds({ vx: 0, vy: 0, x: 0.8, y: 0.8 })).toBe(true);
    expect(distanceFromCenter({ vx: 0, vy: 0, x: 3, y: 4 })).toBe(5);
  });
});

describe("scoreTurn", () => {
  test("one point per second plus a streak bonus", () => {
    expect(scoreTurn(0, 0)).toBe(0);
    expect(scoreTurn(9900, 0)).toBe(9);
    expect(scoreTurn(10_000, 6000)).toBe(13);
  });

  test("surviving longer never scores less", () => {
    let previous = -1;
    for (let ms = 0; ms <= 60_000; ms += 1000) {
      const score = scoreTurn(ms, 0);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });
});

describe("deviceToScreenTilt (display rotation remap)", () => {
  // Tilting the device's own right edge down gives +x on the raw sensor.
  test("natural orientation keeps x and flips y to screen-down", () => {
    expect(deviceToScreenTilt(0.5, 0.2, 0)).toEqual({ x: 0.5, y: -0.2 });
  });

  test("rotated 90° CCW: device top is screen-left", () => {
    // Device right edge now points up the screen → raw +x is screen-up (-y).
    expect(deviceToScreenTilt(1, 0, 90)).toEqual({ x: -0, y: -1 });
    // Device top edge points left → raw +y is screen-left (-x).
    expect(deviceToScreenTilt(0, 1, 90)).toEqual({ x: -1, y: -0 });
  });

  test("upside down inverts both screen axes", () => {
    expect(deviceToScreenTilt(0.5, 0.2, 180)).toEqual({ x: -0.5, y: 0.2 });
  });

  test("rotated 90° CW (-90 / 270) mirrors the 90° case", () => {
    expect(deviceToScreenTilt(1, 0, -90)).toEqual({ x: 0, y: 1 });
    expect(deviceToScreenTilt(0, 1, -90)).toEqual({ x: 1, y: 0 });
    expect(deviceToScreenTilt(0.3, 0.4, 270)).toEqual(
      deviceToScreenTilt(0.3, 0.4, -90)
    );
  });

  test("every rotation preserves tilt magnitude", () => {
    for (const r of [0, 90, 180, -90]) {
      const { x, y } = deviceToScreenTilt(0.3, 0.4, r);
      expect(Math.hypot(x, y)).toBeCloseTo(0.5);
    }
  });
});
