import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against the Expo **web** export (see CLAUDE.md "E2E").
 *
 * The webServer builds a fresh `expo export --platform web` into `dist-e2e/`
 * and serves it with `e2e/serve.mjs` (static files + `.html` resolution +
 * dynamic-route / SPA fallback). `E2E_SKIP_BUILD=1` reuses an existing
 * `dist-e2e/` for quick local reruns.
 *
 * Local runs use the preinstalled browsers when `PLAYWRIGHT_BROWSERS_PATH`
 * is set; `E2E_CHROMIUM_PATH` can point at a specific chrome binary.
 */
const PORT = Number(process.env.E2E_PORT ?? 8099);
const isCI = Boolean(process.env.CI);
const skipBuild = process.env.E2E_SKIP_BUILD === "1";
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

const build = "npx expo export --platform web --output-dir dist-e2e";
const serve = `node e2e/serve.mjs dist-e2e ${PORT}`;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  fullyParallel: true,
  outputDir: "../test-results",
  projects: [
    {
      name: "phone",
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        hasTouch: true,
        viewport: { height: 1180, width: 820 },
      },
    },
  ],
  reporter: isCI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "../playwright-report" }],
      ]
    : [["list"]],
  retries: isCI ? 1 : 0,
  testDir: ".",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: executablePath ? { executablePath } : {},
    locale: "en-US",
    trace: "on-first-retry",
  },
  webServer: {
    command: skipBuild ? serve : `${build} && ${serve}`,
    cwd: "..",
    reuseExistingServer: false,
    stdout: "ignore",
    timeout: 300_000,
    url: `http://127.0.0.1:${PORT}/`,
  },
  workers: isCI ? 2 : undefined,
});
