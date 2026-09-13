import type { TranslationKey } from "@/i18n/translations";

/**
 * Turbulence Tales content: emoji tile decks, connector words and opening
 * frames. Emoji are language-neutral, so only the connectors and frames go
 * through i18n — the produced story is read aloud in whatever language the
 * players share.
 */

export type TileDeckId = "travel" | "food" | "creatures" | "objects" | "weather";

export const tileDecks: Record<TileDeckId, string[]> = {
	travel: [
		"✈️", "🛫", "🛬", "🧳", "🎒", "🗺️", "🧭", "🛂", "🎫", "🚕", "🚆", "🚢", "🚁", "🛸", "🚀",
		"🏨", "🏖️", "🏔️", "🏝️", "🗼", "🗽", "🏰", "⛩️", "🕌", "🎡", "🌋", "🏟️", "⛺", "🛶", "🚲",
	],
	food: [
		"🍕", "🍣", "🌮", "🍜", "🥐", "🧀", "🍫", "🍦", "🍩", "🥑", "🍌", "🍍", "🥥", "🌶️", "🍤",
		"🍔", "🥨", "🧁", "🍿", "☕", "🧃", "🍹", "🥤", "🍯", "🥟", "🍱", "🍪", "🥞", "🍋", "🧇",
	],
	creatures: [
		"🐶", "🐱", "🦜", "🐬", "🦩", "🐙", "🦀", "🐧", "🦒", "🐘", "🦁", "🐒", "🦥", "🐢", "🦈",
		"🐝", "🦋", "🐸", "🦉", "🐲", "🦄", "👽", "🤖", "👻", "🧙", "🧜", "🧛", "🦸", "👮", "🧑‍✈️",
	],
	objects: [
		"📱", "📷", "🎧", "🔑", "💍", "👓", "🧦", "👒", "🩴", "💼", "📚", "🎸", "🎲", "🧸", "🪁",
		"💎", "🔮", "🪄", "⏰", "🧯", "🪂", "🛟", "🔦", "🧲", "🎁", "💌", "🗿", "🎈", "🪑", "🧻",
	],
	weather: [
		"☀️", "🌧️", "⛈️", "🌪️", "🌈", "❄️", "🌊", "🌙", "⭐", "☄️", "🌫️", "💨", "🔥", "⚡", "🌅",
		"🌬️", "🎆", "💫", "🌍", "🕳️", "💥", "✨", "🫧", "🌀", "🧊", "🌤️", "🌩️", "🌠", "🌦️", "🌑",
	],
};

export const allTiles: string[] = Object.values(tileDecks).flat();

export type ConnectorId =
	| "then"
	| "but"
	| "suddenly"
	| "because"
	| "meanwhile"
	| "luckily"
	| "unfortunately"
	| "finally";

export const connectors: { id: ConnectorId; key: TranslationKey }[] = [
	{ id: "then", key: "esThen" },
	{ id: "but", key: "esBut" },
	{ id: "suddenly", key: "esSuddenly" },
	{ id: "because", key: "esBecause" },
	{ id: "meanwhile", key: "esMeanwhile" },
	{ id: "luckily", key: "esLuckily" },
	{ id: "unfortunately", key: "esUnfortunately" },
	{ id: "finally", key: "esFinally" },
];

/** Opening lines; `{{emoji}}` is replaced with a random travel tile. */
export const storyFrameKeys: TranslationKey[] = [
	"esFrame1",
	"esFrame2",
	"esFrame3",
	"esFrame4",
	"esFrame5",
	"esFrame6",
	"esFrame7",
	"esFrame8",
	"esFrame9",
	"esFrame10",
];

export const actKeys: TranslationKey[] = ["esActDeparture", "esActTurbulence", "esActLanding"];
