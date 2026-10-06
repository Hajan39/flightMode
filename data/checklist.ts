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

export interface ChecklistTemplateItem {
  id: string;
  labelKey: TranslationKey;
}

export interface ChecklistSection {
  /** Ionicons glyph name. */
  icon: string;
  id: ChecklistSectionId;
  items: ChecklistTemplateItem[];
  titleKey: TranslationKey;
}

export const checklistSections: ChecklistSection[] = [
  {
    icon: "alarm-outline",
    id: "beforeDeparture",
    items: [
      { id: "bd-checkin", labelKey: "checklistItemCheckInOnline" },
      { id: "bd-boarding-pass", labelKey: "checklistItemDownloadBoardingPass" },
      { id: "bd-charge", labelKey: "checklistItemChargeDevices" },
      { id: "bd-download", labelKey: "checklistItemDownloadContent" },
      { id: "bd-alarm", labelKey: "checklistItemSetAlarm" },
    ],
    titleKey: "checklistSectionBeforeDeparture",
  },
  {
    icon: "id-card-outline",
    id: "documents",
    items: [
      { id: "doc-passport", labelKey: "checklistItemPassport" },
      { id: "doc-visa", labelKey: "checklistItemVisa" },
      { id: "doc-boarding", labelKey: "checklistItemBoardingPass" },
      { id: "doc-insurance", labelKey: "checklistItemInsurance" },
      { id: "doc-hotel", labelKey: "checklistItemHotelAddress" },
    ],
    titleKey: "checklistSectionDocuments",
  },
  {
    icon: "bag-handle-outline",
    id: "carryOn",
    items: [
      { id: "co-headphones", labelKey: "checklistItemHeadphones" },
      { id: "co-charger", labelKey: "checklistItemCharger" },
      { id: "co-bottle", labelKey: "checklistItemWaterBottle" },
      { id: "co-snacks", labelKey: "checklistItemSnacks" },
      { id: "co-pillow", labelKey: "checklistItemNeckPillow" },
      { id: "co-medication", labelKey: "checklistItemMedication" },
      { id: "co-pen", labelKey: "checklistItemPen" },
    ],
    titleKey: "checklistSectionCarryOn",
  },
  {
    icon: "location-outline",
    id: "atArrival",
    items: [
      { id: "ar-airplane-mode", labelKey: "checklistItemAirplaneModeOff" },
      { id: "ar-cash", labelKey: "checklistItemCashForTransport" },
      { id: "ar-immigration", labelKey: "checklistItemImmigrationForm" },
      { id: "ar-route", labelKey: "checklistItemRouteFromAirport" },
      { id: "ar-checkin-time", labelKey: "checklistItemHotelCheckInTime" },
    ],
    titleKey: "checklistSectionAtArrival",
  },
  {
    icon: "git-branch-outline",
    id: "connection",
    items: [
      { id: "cn-gate", labelKey: "checklistItemCheckGate" },
      { id: "cn-mct", labelKey: "checklistItemMinConnectionTime" },
      { id: "cn-rebook", labelKey: "checklistItemRebookContact" },
      { id: "cn-liquids", labelKey: "checklistItemLiquids" },
      { id: "cn-food", labelKey: "checklistItemLoungeFoodPlan" },
    ],
    titleKey: "checklistSectionConnection",
  },
];

/** Flat list of every default item id — used for progress math. */
export const defaultItemIds: string[] = checklistSections.flatMap((section) =>
  section.items.map((item) => item.id)
);
