import { expect, pathOf, readStoreState, test } from "./fixtures";

const homeTab = (page: import("@playwright/test").Page) =>
  page.getByRole("tab", { name: /Home/ });

async function expectHome(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(homeTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Daily Flight Challenge")).toBeVisible();
}

test.describe("onboarding", () => {
  test("fresh user is sent to onboarding and can skip it", async ({
    page,
    guard,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText("Choose Your Language")).toBeVisible();

    await page.getByText("Skip", { exact: true }).click();
    await expectHome(page);
    const settings = await readStoreState(page, "settings");
    expect(settings?.isFirstLaunch).toBe(false);

    // Regression: a reload on web used to bounce back to onboarding.
    await page.reload();
    await expectHome(page);
    expect(pathOf(page)).toBe("/");
    expect(guard.externalRequests).toEqual([]);
  });

  test("fresh user can step through to Get Started", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);

    const getStarted = page.getByText("Get Started", { exact: true });
    const next = page.getByText("Next", { exact: true });
    // Six pages (language, welcome, offline, prefs, currency, recommendations).
    for (let step = 0; step < 10; step += 1) {
      if (await getStarted.isVisible()) {
        break;
      }
      await next.click();
    }
    await getStarted.click();
    await expectHome(page);

    await page.reload();
    await expectHome(page);
  });
});
