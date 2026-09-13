import type { TranslationKey } from "@/i18n/translations";

/**
 * Default travel-checklist templates. Item ids are stable and persisted in
 * `useChecklistStore.checkedIds`, so never rename one — add a new id instead.
 */

export type ChecklistSectionId =
	| "beforeDeparture"
	| "documents"
	| "carryOn"
	| "atArrival"
	| "connection";

export type ChecklistTemplateItem = {
	id: string;
	labelKey: TranslationKey;
};

export type ChecklistSection = {
	id: ChecklistSectionId;
	titleKey: TranslationKey;
	/** Ionicons glyph name. */
	icon: string;
	items: ChecklistTemplateItem[];
};

export const checklistSections: ChecklistSection[] = [
	{
		id: "beforeDeparture",
		titleKey: "checklistSectionBeforeDeparture",
		icon: "alarm-outline",
		items: [
			{ id: "bd-checkin", labelKey: "checklistItemCheckInOnline" },
			{ id: "bd-boarding-pass", labelKey: "checklistItemDownloadBoardingPass" },
			{ id: "bd-charge", labelKey: "checklistItemChargeDevices" },
			{ id: "bd-download", labelKey: "checklistItemDownloadContent" },
			{ id: "bd-alarm", labelKey: "checklistItemSetAlarm" },
		],
	},
	{
		id: "documents",
		titleKey: "checklistSectionDocuments",
		icon: "id-card-outline",
		items: [
			{ id: "doc-passport", labelKey: "checklistItemPassport" },
			{ id: "doc-visa", labelKey: "checklistItemVisa" },
			{ id: "doc-boarding", labelKey: "checklistItemBoardingPass" },
			{ id: "doc-insurance", labelKey: "checklistItemInsurance" },
			{ id: "doc-hotel", labelKey: "checklistItemHotelAddress" },
		],
	},
	{
		id: "carryOn",
		titleKey: "checklistSectionCarryOn",
		icon: "bag-handle-outline",
		items: [
			{ id: "co-headphones", labelKey: "checklistItemHeadphones" },
			{ id: "co-charger", labelKey: "checklistItemCharger" },
			{ id: "co-bottle", labelKey: "checklistItemWaterBottle" },
			{ id: "co-snacks", labelKey: "checklistItemSnacks" },
			{ id: "co-pillow", labelKey: "checklistItemNeckPillow" },
			{ id: "co-medication", labelKey: "checklistItemMedication" },
			{ id: "co-pen", labelKey: "checklistItemPen" },
		],
	},
	{
		id: "atArrival",
		titleKey: "checklistSectionAtArrival",
		icon: "location-outline",
		items: [
			{ id: "ar-airplane-mode", labelKey: "checklistItemAirplaneModeOff" },
			{ id: "ar-cash", labelKey: "checklistItemCashForTransport" },
			{ id: "ar-immigration", labelKey: "checklistItemImmigrationForm" },
			{ id: "ar-route", labelKey: "checklistItemRouteFromAirport" },
			{ id: "ar-checkin-time", labelKey: "checklistItemHotelCheckInTime" },
		],
	},
	{
		id: "connection",
		titleKey: "checklistSectionConnection",
		icon: "git-branch-outline",
		items: [
			{ id: "cn-gate", labelKey: "checklistItemCheckGate" },
			{ id: "cn-mct", labelKey: "checklistItemMinConnectionTime" },
			{ id: "cn-rebook", labelKey: "checklistItemRebookContact" },
			{ id: "cn-liquids", labelKey: "checklistItemLiquids" },
			{ id: "cn-food", labelKey: "checklistItemLoungeFoodPlan" },
		],
	},
];

/** Flat list of every default item id — used for progress math. */
export const defaultItemIds: string[] = checklistSections.flatMap((section) =>
	section.items.map((item) => item.id),
);
