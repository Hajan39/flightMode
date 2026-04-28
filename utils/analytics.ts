export type AnalyticsEventName =
	| "app_open"
	| "onboarding_complete"
	| "flight_added"
	| "flight_edited"
	| "game_start"
	| "game_finish"
	| "article_open"
	| "article_finish"
	| "relax_start"
	| "relax_finish"
	| "audio_play"
	| "audio_stop"
	| "premium_view";

export type AnalyticsProperties = Record<
	string,
	string | number | boolean | null | undefined
>;

type AnalyticsSink = (
	eventName: AnalyticsEventName,
	properties?: Record<string, string | number | boolean>,
) => void;

const MAX_PENDING_EVENTS = 100;

let sink: AnalyticsSink | null = null;
let disabled = false;
let pendingEvents: Array<{
	eventName: AnalyticsEventName;
	properties?: Record<string, string | number | boolean>;
}> = [];

function sanitizeProperties(properties?: AnalyticsProperties) {
	if (!properties) return undefined;

	return Object.fromEntries(
		Object.entries(properties).filter(
			(entry): entry is [string, string | number | boolean] =>
				entry[1] !== null && entry[1] !== undefined,
		),
	);
}

export function setAnalyticsSink(nextSink: AnalyticsSink | null) {
	sink = nextSink;
	disabled = false;

	if (!sink) return;

	const eventsToFlush = pendingEvents;
	pendingEvents = [];
	for (const event of eventsToFlush) {
		sink(event.eventName, event.properties);
	}
}

export function disableAnalytics() {
	disabled = true;
	sink = null;
	pendingEvents = [];
}

export function captureAnalyticsEvent(
	eventName: AnalyticsEventName,
	properties?: AnalyticsProperties,
) {
	if (disabled) return;

	const sanitizedProperties = sanitizeProperties(properties);

	if (sink) {
		sink(eventName, sanitizedProperties);
		return;
	}

	if (pendingEvents.length < MAX_PENDING_EVENTS) {
		pendingEvents.push({ eventName, properties: sanitizedProperties });
	}
}
