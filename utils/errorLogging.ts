import { captureAnalyticsEvent } from "@/utils/analytics";

/**
 * Central place to record a fatal/uncaught error so it surfaces in:
 * - Android logcat (captured by Google Play Pre-launch report & crash logs)
 * - PostHog analytics (when enabled)
 *
 * Payload is strictly technical (error name, truncated message, first stack
 * frames, originating surface). It must never contain personal data or
 * free-form user text — see analytics hard rules.
 */
export function logFatalError(
	error: unknown,
	source: "render" | "global" | "promise",
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

	// Goes to Android logcat → visible in Play Console Pre-launch report.
	// Tagged so it is easy to grep for in device logs.
	// eslint-disable-next-line no-console
	console.error(`[FlightMode][fatal][${source}] ${name}: ${message}\n${stackHead}`);

	try {
		captureAnalyticsEvent("app_error", {
			source,
			error_name: name,
			error_message: message,
			stack_head: stackHead,
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
	if (installed) return;
	installed = true;

	const globalErrorUtils = (
		globalThis as {
			ErrorUtils?: {
				getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
				setGlobalHandler?: (
					handler: (error: unknown, isFatal?: boolean) => void,
				) => void;
			};
		}
	).ErrorUtils;

	if (!globalErrorUtils?.setGlobalHandler) return;

	const previous = globalErrorUtils.getGlobalHandler?.();

	globalErrorUtils.setGlobalHandler((error, isFatal) => {
		logFatalError(error, "global");
		if (previous) previous(error, isFatal);
	});
}
