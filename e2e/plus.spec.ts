import { expect, seedSettings, test } from "./fixtures";

// Plus extras without Plus (the default on web: no billing module).

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
});

test("a Plus article shows its intro and a calm upsell, not the full text", async ({
  page,
  guard,
}) => {
  await page.goto("/content/plus-turbulence-explained");
  await expect(
    page.getByText("Fear of flying: what the bumps really are").first()
  ).toBeVisible();
  // Intro paragraph is the preview…
  await expect(
    page.getByText(/If your hands grip the armrest/).first()
  ).toBeVisible();
  // …the rest is not rendered.
  await expect(
    page.getByText("What turbulence is", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("Read the rest with Plus")).toBeVisible();
  await page.getByRole("button", { name: "See what Plus includes" }).click();
  await expect(page).toHaveURL(/\/plus$/);
  await expect(
    page.getByText("No ads, ever. Everything free stays free.")
  ).toBeVisible();
  expect(guard.externalRequests).toEqual([]);
});

test("free articles stay fully readable", async ({ page }) => {
  await page.goto("/content/sleep-on-plane");
  await expect(page.getByText("Choose Your Seat Wisely")).toBeVisible();
  await expect(page.getByText("Read the rest with Plus")).toHaveCount(0);
});

test("box breathing stays free; a Plus pattern opens the Plus screen", async ({
  page,
}) => {
  await page.goto("/relax");
  await expect(
    page.getByRole("button", { name: "4-4-4-4 Box Breathing" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Breathe In", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "4-7-8 for sleep (included with Plus)" })
    .click();
  await expect(page).toHaveURL(/\/plus$/);
});
