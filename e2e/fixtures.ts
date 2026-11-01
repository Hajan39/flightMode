import {
  test as base,
  expect as baseExpect,
  type Page,
} from "@playwright/test";

/**
 * Uncaught page errors that are known and tolerated. Anything else thrown in
 * the page fails the test (see the `guard` fixture below).
 *
 * - React #418 (hydration text mismatch): the static web export pre-renders
 *   with default settings, the client hydrates with the stored ones. Known,
 *   pre-existing, harmless (React re-renders on the client).
 */
export const KNOWN_PAGE_ERRORS: readonly RegExp[] = [
  /Minified React error #418/,
];

const LOCAL_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;

const isExternal = (url: string) =>
  /^(https?|wss?):/.test(url) && !LOCAL_ORIGIN.test(url);

interface Guard {
  /** Every non-localhost request the page attempted (all are blocked). */
  externalRequests: string[];
  /** Uncaught page errors not in `KNOWN_PAGE_ERRORS`. */
  unexpectedErrors: string[];
}

export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ context, page }, use) => {
      const guard: Guard = { externalRequests: [], unexpectedErrors: [] };
      // Offline-first app: nothing may leave the machine during a test.
      await context.route(
        (url) => isExternal(url.href),
        (route) => route.abort("blockedbyclient")
      );
      page.on("request", (request) => {
        if (isExternal(request.url())) {
          guard.externalRequests.push(request.url());
        }
      });
      page.on("pageerror", (error) => {
        const text = `${error.name}: ${error.message}`;
        if (!KNOWN_PAGE_ERRORS.some((known) => known.test(text))) {
          guard.unexpectedErrors.push(text);
        }
      });
      await use(guard);
      baseExpect(guard.unexpectedErrors, "uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export const expect = baseExpect;

export interface SeedOptions {
  kidsMode?: boolean;
}

/**
 * Seeds the persisted settings store (zustand `persist` → AsyncStorage →
 * `localStorage["settings"]`) before the app boots: onboarding done,
 * English, kids mode as given. Only seeds when nothing is stored yet, so a
 * reload keeps whatever the app wrote meanwhile.
 */
export async function seedSettings(
  page: Page,
  { kidsMode = false }: SeedOptions = {}
) {
  await page.addInitScript((kids) => {
    if (!window.location.protocol.startsWith("http")) {
      return; // about:blank after history.back(): no storage access there
    }
    if (window.localStorage.getItem("settings") === null) {
      window.localStorage.setItem(
        "settings",
        JSON.stringify({
          state: { isFirstLaunch: false, kidsMode: kids, language: "en" },
          version: 0,
        })
      );
    }
  }, kidsMode);
}

/** Raw `localStorage` value (persisted stores, analytics hold queue). */
export function readStorage(page: Page, key: string) {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

/** Parsed `state` of a persisted zustand store. */
export async function readStoreState<T = Record<string, unknown>>(
  page: Page,
  key: string
): Promise<T | null> {
  const raw = await readStorage(page, key);
  return raw === null ? null : (JSON.parse(raw).state as T);
}

/** Path of the current URL (`/kids`, `/game/memory`, …). */
export const pathOf = (page: Page) => new URL(page.url()).pathname;
