import type { Locator, Page } from "@playwright/test";

import { generateMaze, solveMaze } from "../utils/kidsMaze";
import {
  expect,
  pathOf,
  readStorage,
  readStoreState,
  seedSettings,
  test,
} from "./fixtures";

/** Kids home tiles, simplest first (`data/kidsGames.ts`). */
const KIDS_TILES = [
  "Peekaboo",
  "Colours",
  "Find it",
  "Shadows",
  "Count",
  "Pairs",
  "Shapes",
  "Catch",
  "Dots",
  "Repeat",
  "Maze",
  "Puzzle",
] as const;

/** Persisted state kids mode must never touch (see CLAUDE.md "Kids mode"). */
const GUARDED_KEYS = [
  "game_progress",
  "achievements",
  "analytics_hold_queue",
] as const;

const tile = (page: Page, name: string) =>
  page.getByRole("button", { exact: true, name });

const celebration = (page: Page) => page.getByLabel("Well done!");

/** The 🏠 in the kids game top bar (the celebration has a second one). */
const homeButton = (page: Page) =>
  page.getByRole("button", { exact: true, name: "Home" }).first();

/** Game buttons of a kids game screen (everything but the 🏠). */
const gameButtons = (page: Page) =>
  page.getByRole("button").filter({ hasNotText: "🏠" });

async function expectKidsHome(page: Page) {
  await expect(page).toHaveURL(/\/kids$/);
  await expect(page.getByRole("button", { name: "Parent lock" })).toBeVisible();
  for (const name of KIDS_TILES) {
    await expect(tile(page, name)).toBeVisible();
  }
}

/** Snapshot of the guarded keys, taken once the stores have hydrated. */
async function snapshotGuarded(page: Page) {
  await expect.poll(() => readStorage(page, "game_progress")).not.toBeNull();
  const out: Record<string, string | null> = {};
  for (const key of GUARDED_KEYS) {
    out[key] = await readStorage(page, key);
  }
  return out;
}

/**
 * Bright stars in the progress row (`KidsStars`): done stars are opaque,
 * pending ones dimmed. The row is decoration hidden from screen readers and
 * shows no numbers, so its opacity is the only progress signal a kids game
 * exposes. Skips hidden screens and stars inside buttons (falling items,
 * the whack-a-mole "pop").
 */
function litStars(page: Page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll("div")].filter(
        (el) =>
          el.children.length === 0 &&
          el.textContent === "⭐" &&
          el.offsetParent !== null &&
          !el.closest('[role="button"]') &&
          getComputedStyle(el).opacity === "1"
      ).length
  );
}

/**
 * Simon playback: the lit pad is drawn at full opacity while the others are
 * dimmed (pads are disabled meanwhile). Returns the lit pad's label.
 */
async function waitForLitPad(page: Page): Promise<string> {
  const handle = await page.waitForFunction(
    () => {
      const pads = [
        ...document.querySelectorAll('[role="button"][aria-disabled="true"]'),
      ].filter((el) => (el as HTMLElement).offsetParent !== null);
      const lit = pads.find((el) => getComputedStyle(el).opacity === "1");
      return lit?.getAttribute("aria-label") ?? null;
    },
    null,
    { polling: 50 }
  );
  return (await handle.jsonValue()) as string;
}

async function openKidsGame(page: Page, name: string, id: string) {
  await tile(page, name).click();
  await expect(page).toHaveURL(new RegExp(`/kids/${id}$`));
  await expect(homeButton(page)).toBeVisible();
}

async function backToKidsHome(page: Page) {
  await homeButton(page).click();
  await expectKidsHome(page);
}

/** Waits until a located element is removed from the DOM (re-render). */
async function waitDetached(page: Page, locator: Locator) {
  const handle = await locator.elementHandle();
  await page.waitForFunction((el) => !el?.isConnected, handle);
}

/* ------------------------------------------------------------- solvers */

/** Shortest slide sequence (tile values to press) for the 3×3 puzzle. */
function solveSlide(board: number[]): number[] {
  const goal = "1,2,3,4,5,6,7,8,0";
  const start = board.join(",");
  const prev = new Map<string, { from: string; value: number } | null>([
    [start, null],
  ]);
  const queue = [start];
  while (queue.length > 0) {
    const key = queue.shift() as string;
    if (key === goal) {
      break;
    }
    const cells = key.split(",").map(Number);
    const empty = cells.indexOf(0);
    const row = Math.floor(empty / 3);
    const col = empty % 3;
    const neighbors = [
      row > 0 ? empty - 3 : -1,
      row < 2 ? empty + 3 : -1,
      col > 0 ? empty - 1 : -1,
      col < 2 ? empty + 1 : -1,
    ].filter((n) => n >= 0);
    for (const n of neighbors) {
      const next = [...cells];
      next[empty] = cells[n];
      next[n] = 0;
      const nextKey = next.join(",");
      if (!prev.has(nextKey)) {
        prev.set(nextKey, { from: key, value: cells[n] });
        queue.push(nextKey);
      }
    }
  }
  const moves: number[] = [];
  for (let step = prev.get(goal); step; step = prev.get(step.from)) {
    moves.unshift(step.value);
  }
  return moves;
}

async function readSlideBoard(page: Page): Promise<number[]> {
  const ids = await page
    .locator('[data-testid^="kids-slot-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  const board = new Array<number>(9).fill(-1);
  for (const id of ids) {
    const [, , index, value] = (id ?? "").split("-");
    board[Number(index)] = Number(value);
  }
  return board;
}

/** Drags the mouse through the centres of `points` (a finger on a phone). */
async function dragThrough(page: Page, points: { x: number; y: number }[]) {
  const [first, ...rest] = points;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) {
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  await page.mouse.up();
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("element not laid out");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The maze board (`kids-maze-<size>-<seed>`), not its squares. */
const mazeBoard = (page: Page) =>
  page.locator(
    '[data-testid^="kids-maze-"]:not([data-testid^="kids-maze-cell-"])'
  );

/* --------------------------------------------------------------- tests */

test.describe("kids mode", () => {
  test.afterEach(({ guard }) => {
    // Privacy: no request may leave the device during a kids session
    // (PostHog or anything else — every non-localhost host counts).
    expect(guard.externalRequests).toEqual([]);
  });

  test("turns on from Settings via the explanation sheet", async ({ page }) => {
    await seedSettings(page, { kidsMode: false });
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await page.getByRole("button", { name: "Kids mode" }).click();
    const sheet = page.getByRole("dialog");
    await expect(
      sheet.getByRole("heading", { name: "Kids mode" })
    ).toBeVisible();
    await expect(sheet).toContainText("hold the lock for 3 seconds");
    await sheet.getByRole("button", { name: "Turn on" }).click();

    await expectKidsHome(page);
    // a11y smoke: every tile is a button with a non-empty accessible name.
    const names = await page
      .getByRole("button")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    expect(names).toEqual(expect.arrayContaining([...KIDS_TILES]));
    expect(names.every((n) => typeof n === "string" && n.length > 0)).toBe(
      true
    );
    const settings = await readStoreState(page, "settings");
    expect(settings?.kidsMode).toBe(true);

    // Browser back must not reveal the adult screens. Today the route lock
    // answers the popped "/" by leaving the app (history start, like the
    // Android back = background); staying on /kids is accepted too.
    await page.goBack();
    await expect.poll(() => page.url()).toMatch(/^about:blank$|\/kids$/);
    if (page.url() !== "about:blank") {
      await expectKidsHome(page);
      await expect(page.getByRole("tab")).toHaveCount(0);
    }
  });

  test("route lock keeps every adult route on /kids", async ({ page }) => {
    await seedSettings(page, { kidsMode: true });
    await page.goto("/kids");
    await expectKidsHome(page);
    for (const path of [
      "/",
      "/plus",
      "/settings",
      "/game/memory",
      "/content/anything",
      "/games",
      "/profile",
    ]) {
      await page.goto(path);
      await expect(page, `${path} must redirect`).toHaveURL(/\/kids$/);
      await expectKidsHome(page);
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/kids$/);
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test.describe("games (no recorded progress)", () => {
    let before: Record<string, string | null>;

    test.beforeEach(async ({ page }) => {
      await seedSettings(page, { kidsMode: true });
      await page.goto("/kids");
      await expectKidsHome(page);
      before = await snapshotGuarded(page);
    });

    test.afterEach(async ({ page }) => {
      // Progress isolation: game store, achievements and the analytics
      // hold queue are byte-for-byte unchanged after playing.
      expect(await snapshotGuarded(page)).toEqual(before);
    });

    test("Pairs (memory): match every pair → celebration", async ({ page }) => {
      await openKidsGame(page, "Pairs", "memory");
      const cards = gameButtons(page);
      await expect(cards).toHaveCount(6);
      const faces = new Map<number, string>();

      const flip = async (index: number) => {
        await cards.nth(index).click();
        await expect(cards.nth(index)).not.toHaveAttribute(
          "aria-label",
          `Card ${index + 1}`
        );
        const face = (await cards.nth(index).getAttribute("aria-label")) ?? "";
        faces.set(index, face);
        return face;
      };

      // Peek in pairs (0,1), (2,3), (4,5); a mismatch turns back after 1.2 s.
      const matched = new Set<number>();
      for (let i = 0; i < 6; i += 2) {
        const a = await flip(i);
        const b = await flip(i + 1);
        if (a === b) {
          matched.add(i).add(i + 1);
        } else {
          await expect(cards.nth(i)).toHaveAttribute(
            "aria-label",
            `Card ${i + 1}`
          );
        }
      }
      // Now every face is known: open the remaining pairs.
      for (const [index, face] of faces) {
        if (matched.has(index)) {
          continue;
        }
        const partner = [...faces].find(
          ([other, f]) => other !== index && f === face
        )?.[0] as number;
        // A match stays face-up; the very last one ends the game at once,
        // so no per-card label check here.
        await cards.nth(index).click();
        await cards.nth(partner).click();
        matched.add(index).add(partner);
      }
      await expect(celebration(page)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Play again" })
      ).toBeVisible();
      await backToKidsHome(page);
    });

    test("Find it (odd one out): 5 rounds → celebration", async ({ page }) => {
      await openKidsGame(page, "Find it", "odd-one-out");
      for (let round = 0; round < 5; round += 1) {
        const labels = await gameButtons(page).evaluateAll((els) =>
          els.map((el) => el.getAttribute("aria-label") ?? "")
        );
        expect(labels.length).toBe(round < 3 ? 4 : 6);
        const odd = labels.findIndex(
          (l) => labels.indexOf(l) === labels.lastIndexOf(l)
        );
        expect(odd).toBeGreaterThanOrEqual(0);
        const target = gameButtons(page).nth(odd);
        await target.click();
        if (round < 4) {
          await waitDetached(page, target); // next round re-renders the grid
        }
      }
      await expect(celebration(page)).toBeVisible();
      await backToKidsHome(page);
    });

    test("Repeat (simon says): watch, then repeat the pad", async ({
      page,
    }) => {
      await openKidsGame(page, "Repeat", "simon-says");
      const pads = gameButtons(page);
      await expect(pads).toHaveCount(4);
      // Playback: the lit pad is aria-selected; pads are disabled meanwhile.
      await expect(pads.first()).toBeDisabled();
      const shown = await waitForLitPad(page);
      await expect(pads.first()).toBeEnabled();
      expect(await litStars(page)).toBe(0);

      await tile(page, shown).click();
      // Correct → a star, and the next (longer) sequence starts playing.
      await expect.poll(() => litStars(page)).toBe(1);
      await expect(pads.first()).toBeDisabled();
      await backToKidsHome(page);
    });

    test("Peekaboo (whack-a-mole): tap 8 moles → celebration", async ({
      page,
    }) => {
      await openKidsGame(page, "Peekaboo", "whack-mole");
      await expect(gameButtons(page)).toHaveCount(6);
      const mole = page.getByRole("button", { exact: true, name: "🐹" });
      // A mole stays up 2.6 s; a tap that lands just as it hides is a no-op,
      // so keep tapping until the celebration (bounded).
      for (let i = 0; i < 20; i += 1) {
        if (await celebration(page).isVisible()) {
          break;
        }
        await mole.click({ timeout: 10_000 }).catch(() => undefined);
      }
      await expect(celebration(page)).toBeVisible();
      await backToKidsHome(page);
    });

    test("Puzzle (sliding): solve the board → celebration", async ({
      page,
    }) => {
      await openKidsGame(page, "Puzzle", "sliding-puzzle");
      const board = await readSlideBoard(page);
      expect([...board].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      const moves = solveSlide(board);
      expect(moves.length).toBeGreaterThan(0);
      for (const [i, value] of moves.entries()) {
        const empty = (await readSlideBoard(page)).indexOf(0);
        await tile(page, `Tile ${value}`).click();
        if (i < moves.length - 1) {
          await expect(
            page.getByTestId(`kids-slot-${empty}-${value}`)
          ).toBeVisible();
        }
      }
      await expect(celebration(page)).toBeVisible();
      await backToKidsHome(page);
    });

    test("Catch (cargo catch): move the basket, catch one", async ({
      page,
    }) => {
      await openKidsGame(page, "Catch", "cargo-catch");
      const lanes = page.getByRole("button", { name: /^Lane \d$/ });
      await expect(lanes).toHaveCount(3);
      await expect(lanes.nth(1)).toContainText("🧺"); // starts in the middle

      const item = page.locator('[data-testid^="kids-item-lane-"]').first();
      await expect(item).toBeAttached();
      const lane = Number(
        ((await item.getAttribute("data-testid")) ?? "").split("-").pop()
      );
      await lanes.nth(lane).click();
      await expect(lanes.nth(lane)).toContainText("🧺");
      await expect.poll(() => litStars(page), { timeout: 15_000 }).toBe(1);
      await backToKidsHome(page);
    });

    test("Maze: drag the animal along the path → next maze", async ({
      page,
    }) => {
      await openKidsGame(page, "Maze", "maze");
      const board = mazeBoard(page);
      const id = (await board.getAttribute("data-testid")) ?? "";
      const [size, seed] = id.split("-").slice(2).map(Number);
      expect(size).toBe(4);
      // Same seeded generator as the app → the solution path.
      const path = solveMaze(generateMaze(size, seed)) as number[];
      expect(path.length).toBeGreaterThan(1);
      const box = await board.boundingBox();
      if (!box) {
        throw new Error("maze not laid out");
      }
      const cell = box.width / size;
      await dragThrough(
        page,
        path.map((c) => ({
          x: box.x + ((c % size) + 0.5) * cell,
          y: box.y + (Math.floor(c / size) + 0.5) * cell,
        }))
      );
      await expect(board).toHaveAttribute("data-testid", /^kids-maze-5-/);
      expect(await litStars(page)).toBe(1);
      await backToKidsHome(page);
    });

    test("Colours: pick a crayon, paint a part, ✓ → celebration", async ({
      page,
    }) => {
      await openKidsGame(page, "Colours", "colouring");
      const done = page.getByRole("button", { exact: true, name: "Done" });
      await expect(done).toBeDisabled();
      await page.getByRole("button", { exact: true, name: "Green" }).click();
      await page.getByRole("button", { exact: true, name: "Part 1" }).click();
      await expect(page.getByTestId("kids-region-0-3")).toBeVisible();
      await page.getByRole("button", { exact: true, name: "Blue" }).click();
      await page.getByRole("button", { exact: true, name: "Part 2" }).click();
      await expect(page.getByTestId("kids-region-1-4")).toBeVisible();
      await done.click();
      await expect(celebration(page)).toBeVisible();
      await backToKidsHome(page);
    });

    test("Shapes: a wrong outline sends it back, the right one keeps it", async ({
      page,
    }) => {
      await openKidsGame(page, "Shapes", "shapes");
      const pieces = page.locator('[data-testid^="kids-shape-piece-"]');
      await expect(pieces).toHaveCount(3);
      const id = (await pieces.first().getAttribute("data-testid")) ?? "";
      const shape = id.replace("kids-shape-piece-", "");
      const piece = page.getByTestId(id);
      const outlines = await page
        .locator('[data-testid^="kids-shape-target-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
      const wrong = outlines.find((o) => o !== `kids-shape-target-${shape}`);

      const home = await centerOf(piece);
      await dragThrough(page, [
        home,
        await centerOf(page.getByTestId(wrong as string)),
      ]);
      await expect(pieces).toHaveCount(3);
      // It glides back to its place in the tray.
      await expect
        .poll(async () => {
          const at = await centerOf(piece);
          return Math.round(Math.hypot(at.x - home.x, at.y - home.y));
        })
        .toBeLessThan(2);

      await dragThrough(page, [
        await centerOf(piece),
        await centerOf(page.getByTestId(`kids-shape-target-${shape}`)),
      ]);
      await expect(pieces).toHaveCount(2);
      await backToKidsHome(page);
    });

    test("Shadows: tap the animal's own shadow → a star", async ({ page }) => {
      await openKidsGame(page, "Shadows", "shadows");
      const animal =
        (await page
          .getByTestId("kids-shadow-animal")
          .getAttribute("aria-label")) ?? "";
      await expect(gameButtons(page)).toHaveCount(3);
      await page
        .getByRole("button", { exact: true, name: `Shadow ${animal}` })
        .click();
      await expect.poll(() => litStars(page)).toBe(1);
      await backToKidsHome(page);
    });

    test("Count: tap the matching number of dots → next round", async ({
      page,
    }) => {
      await openKidsGame(page, "Count", "counting");
      await expect(gameButtons(page)).toHaveCount(5);
      const tray = page.locator('[data-testid^="kids-count-"]');
      const count = Number(
        ((await tray.getAttribute("data-testid")) ?? "").split("-").pop()
      );
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
      const wrong = (count % 3) + 1;
      await page
        .getByRole("button", { exact: true, name: String(wrong) })
        .click();
      await expect(tray).toHaveAttribute("data-testid", `kids-count-${count}`);
      await page
        .getByRole("button", { exact: true, name: String(count) })
        .click();
      // The next round never repeats the same number.
      await expect(tray).not.toHaveAttribute(
        "data-testid",
        `kids-count-${count}`
      );
      await backToKidsHome(page);
    });

    test("Dots: connect 1→5 in order → the picture, then the next one", async ({
      page,
    }) => {
      await openKidsGame(page, "Dots", "dot-to-dot");
      const dots = page.getByRole("button", { name: /^Dot \d$/ });
      await expect(dots).toHaveCount(5);
      const canvas = page.locator('[data-testid^="kids-dots-"]');
      const first = (await canvas.getAttribute("data-testid")) ?? "";
      await page.getByRole("button", { exact: true, name: "Dot 3" }).click();
      for (let n = 1; n <= 5; n += 1) {
        await page
          .getByRole("button", { exact: true, name: `Dot ${n}` })
          .click();
      }
      await expect(canvas).not.toHaveAttribute("data-testid", first);
      await backToKidsHome(page);
    });
  });

  test("parent lock: short press stays, 3 s hold exits", async ({ page }) => {
    await seedSettings(page, { kidsMode: true });
    await page.goto("/kids");
    await expectKidsHome(page);
    const lock = page.getByRole("button", { name: "Parent lock" });
    const box = await lock.boundingBox();
    if (!box) {
      throw new Error("parent lock not laid out");
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Released after ~1 s: cancelled. (Wall-clock holds are the feature.)
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await page.waitForTimeout(2500); // past the 3 s mark: must not unlock
    await expectKidsHome(page);
    expect((await readStoreState(page, "settings"))?.kidsMode).toBe(true);

    // Held 3.2 s: leaves kids mode to Home.
    await page.mouse.down();
    await page.waitForTimeout(3200);
    await page.mouse.up();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
    expect((await readStoreState(page, "settings"))?.kidsMode).toBe(false);

    await page.reload();
    await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
    expect(pathOf(page)).toBe("/");
    // …and /kids is now closed.
    await page.goto("/kids");
    await expect(page).toHaveURL(/\/$/);
  });
});
