import { captureAnalyticsEvent } from "@/utils/analytics";

const MAX_ERROR_CODE_LENGTH = 80;
const MAX_STACK_FRAMES = 5;

const URL_RE = /[a-z][a-z0-9+.-]*:\/\/\S*/gi;
const EMAIL_RE = /\S+@\S+\.\S+/g;
const JSON_RE = /[{[][\s\S]*[}\]]/g;
const QUOTED_RE = /(["'`])[\s\S]*?\1/g;
const PATH_RE = /(?:[a-z]:)?(?:[\\/][^\s\\/:]+)+[\\/]?(?::\d+)*/gi;
const LONG_DIGITS_RE = /\d{5,}/g;
const LEFTOVER_PUNCT_RE = /["'`{}[\]<>]/g;
const WHITESPACE_RE = /\s+/g;
const IDENTIFIER_RE = /^[A-Za-z_$][\w$.]*$/;
// `at fn (file:1:2)` → fn; bare `at file:1:2` (anonymous) → no group.
const V8_FRAME_RE = /^\s*at\s+(?:new\s+)?(?:([^\s(]+)\s*\(|\S)/;
const JSC_FRAME_RE = /^\s*([^@\s]+)@/;

/**
 * Reduces a free-form error message to a short, non-identifying code for
 * analytics: URLs, e-mails, JSON blobs, quoted strings, file paths and digit
 * runs longer than 4 are replaced by placeholders; capped at 80 chars.
 * ("rates http 503" survives; a URL with a query string does not.)
 */
export function sanitizeErrorText(text: unknown): string {
  if (typeof text !== "string" || text.length === 0) {
    return "";
  }
  return text
    .replace(URL_RE, " url ")
    .replace(EMAIL_RE, " email ")
    .replace(JSON_RE, " json ")
    .replace(QUOTED_RE, " str ")
    .replace(PATH_RE, " path ")
    .replace(LONG_DIGITS_RE, "n")
    .replace(LEFTOVER_PUNCT_RE, "")
    .replace(WHITESPACE_RE, " ")
    .trim()
    .slice(0, MAX_ERROR_CODE_LENGTH);
}

/**
 * Keeps only function names of the first stack frames (Hermes/V8 `at fn (…)`
 * and JSC `fn@…` formats) — no file paths, bundle URLs or line numbers.
 */
export function stackFunctionNames(stack: unknown): string {
  if (typeof stack !== "string") {
    return "";
  }
  const names: string[] = [];
  for (const line of stack.split("\n")) {
    if (names.length >= MAX_STACK_FRAMES) {
      break;
    }
    const match = V8_FRAME_RE.exec(line) ?? JSC_FRAME_RE.exec(line);
    if (!match) {
      continue;
    }
    const name = match[1] ?? "";
    names.push(IDENTIFIER_RE.test(name) ? name.slice(0, 60) : "anonymous");
  }
  return names.join(" < ");
}

/**
 * Central place to record a fatal/uncaught error so it surfaces in:
 * - Android logcat (captured by Google Play Pre-launch report & crash logs)
 * - PostHog analytics (when enabled)
 *
 * Logcat gets the full message + stack head (stays on the device unless the
 * user shares logs). Analytics gets only the error name, a sanitized short
 * code and stack function names — never URLs, paths, JSON or user text (see
 * analytics hard rules).
 */
export function logFatalError(
  error: unknown,
  source: "render" | "global" | "promise",
  context?: string
) {
  const err =
    error instanceof Error ? error : new Error(String(error ?? "unknown"));

  const name = err.name || "Error";
  const message = (err.message || "").slice(0, 300);
  // Keep only the first few stack frames; full stacks are noisy and large.
  const stackHead = (err.stack || "")
    .split("\n")
    .slice(0, 6)
    .join("\n")
    .slice(0, 1000);

  const where = context ? `${source}:${context}` : source;

  // Goes to Android logcat → visible in Play Console Pre-launch report.
  // Tagged so it is easy to grep for in device logs.
  // eslint-disable-next-line no-console
  console.error(
    `[FlightMode][fatal][${where}] ${name}: ${message}\n${stackHead}`
  );

  try {
    captureAnalyticsEvent("app_error", {
      context: context ? sanitizeErrorText(context) : null,
      error_code: sanitizeErrorText(message),
      error_name: sanitizeErrorText(name).slice(0, 40) || "Error",
      source,
      stack_head: stackFunctionNames(err.stack),
    });
  } catch {
    // Logging must never throw on top of the original error.
  }
}

let installed = false;

/**
 * Installs a global JS error handler that records uncaught errors which a
 * React error boundary cannot catch (async callbacks, event handlers, native
 * module init). Preserves the previous handler so default fatal behavior
 * (dev red box / runtime termination) still runs after we log.
 */
export function installGlobalErrorHandler() {
  if (installed) {
    return;
  }
  installed = true;

  const globalErrorUtils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (
          handler: (error: unknown, isFatal?: boolean) => void
        ) => void;
      };
    }
  ).ErrorUtils;

  if (!globalErrorUtils?.setGlobalHandler) {
    return;
  }

  const previous = globalErrorUtils.getGlobalHandler?.();

  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    logFatalError(error, "global");
    if (previous) {
      previous(error, isFatal);
    }
  });
}
