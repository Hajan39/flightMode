import type { Page } from "@playwright/test";

import { expect, pathOf, seedSettings, test } from "./fixtures";

/** Games tab → search → open the matching card → game screen. */
async function openGame(page: Page, query: string, card: RegExp, id: string) {
  await page.goto("/games");
  await page.getByRole("textbox", { name: "Search games" }).fill(query);
  await page.getByRole("button", { name: card }).click();
  await expect(page).toHaveURL(new RegExp(`/game/${id}$`));
}

/** Number shown next to a stat label, e.g. "MOVES 3" → 3. */
async function statValue(page: Page, label: RegExp) {
  const text = await page.locator("body").innerText();
  const match = text.match(new RegExp(`${label.source}\\s*(\\d+)`, "i"));
  return match ? Number(match[1]) : Number.NaN;
}

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
});

test("Home renders its key sections", async ({ page, guard }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: /Home/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  for (const section of [
    "Your Flight",
    "Daily Flight Challenge",
    "Ready to play?",
    "Statistics",
    "Play Together",
    "Travel tools",
  ]) {
    await expect(page.getByText(section, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(4);
  expect(guard.externalRequests).toEqual([]);
});

test("Games tab lists games and search filters them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Games/ }).click();
  await expect(page).toHaveURL(/\/games$/);

  const cards = page.getByRole("button", { name: /~\d+ min/ });
  // The list renders progressively; wait for it to fill.
  await expect.poll(() => cards.count()).toBeGreaterThan(20);

  const search = page.getByRole("textbox", { name: "Search games" });
  await search.fill("sudoku");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Sudoku");

  await search.fill("zzzz-no-such-game");
  await expect(cards).toHaveCount(0);

  await search.fill("");
  await expect.poll(() => cards.count()).toBeGreaterThan(20);
});

test("2048: tap to start, move, pause → Quit", async ({ page }) => {
  await openGame(page, "2048", /2048/, "twenty-forty-eight");
  await page.getByRole("button", { name: "Tap to start" }).click();
  for (const dir of ["left", "right", "up", "down"]) {
    await page.getByRole("button", { name: `Move ${dir}` }).click();
  }
  // Two starting tiles on a 4×4 board: at least one direction moves.
  await expect.poll(() => statValue(page, /Moves/)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Quit" }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test("Sudoku: pick Easy, use a hint, pause → Quit", async ({ page }) => {
  await openGame(page, "sudoku", /Sudoku/, "sudoku");
  await page.getByText("Tap to start").click();
  await page.getByRole("button", { name: "Easy" }).click();
  await expect(page.getByText("3 hints left")).toBeVisible();
  await page.getByText("3 hints left").click();
  await expect(page.getByText("2 hints left")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Quit" }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test("Memory: flip two cards, header back", async ({ page }) => {
  await openGame(page, "memory", /Memory/, "memory");
  // Face-down cards show "?"; the rules button "?" comes first in the DOM,
  // so take cards from the end of the list.
  const faceDown = page.getByText("?", { exact: true });
  const before = await faceDown.count();
  await faceDown.last().click();
  await expect(faceDown).toHaveCount(before - 1);
  await faceDown.last().click();
  await expect.poll(() => statValue(page, /Moves/)).toBe(1);

  await page.getByRole("link", { name: /back/ }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test("Settings opens with Kids mode, Privacy Policy and Website rows", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kids mode" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Privacy Policy" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "FlightMode Website" })
  ).toBeVisible();
  expect(pathOf(page)).toBe("/settings");
});
