import type { Product, Purchase } from "expo-iap";
import { Platform } from "react-native";

import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

/** Play Console product ids (one-time products). Create them with exactly these ids. */
export const PLUS_SKU = "flightmode_plus";
export const TIP_SKUS = ["tip_small", "tip_medium", "tip_large"] as const;
const ALL_SKUS = [PLUS_SKU, ...TIP_SKUS];

/**
 * Play Billing via expo-iap. Everything is guarded: in Expo Go / web / a build
 * without the native module every call is a no-op, and billing failures never
 * touch offline UX. ponytail: entitlement is trusted client-side (no receipt
 * server) — fine for a supporter unlock; add server verification if Plus ever
 * gates something valuable enough to be worth pirating.
 */
type ExpoIap = typeof import("expo-iap");

let iap: ExpoIap | null = null;
let connected: Promise<boolean> | null = null;

/** What the Plus screen needs to know about a checkout in flight. */
export type PurchaseUpdate = "pending" | "purchased";

type PurchaseUpdateListener = (
  productId: string,
  update: PurchaseUpdate
) => void;

const purchaseUpdateListeners = new Set<PurchaseUpdateListener>();

/**
 * Listen for checkout results (e.g. a "pending" cash / bank payment that
 * Play completes later). Returns the unsubscribe function.
 */
export function subscribePurchaseUpdates(listener: PurchaseUpdateListener) {
  purchaseUpdateListeners.add(listener);
  return () => {
    purchaseUpdateListeners.delete(listener);
  };
}

/** Exported for tests: fan a store purchase out to the screen listeners. */
export function notifyPurchaseUpdate(purchase: Purchase) {
  const { purchaseState } = purchase;
  if (purchaseState !== "pending" && purchaseState !== "purchased") {
    return;
  }
  for (const listener of purchaseUpdateListeners) {
    listener(purchase.productId, purchaseState);
  }
}

function loadIap(): ExpoIap | null {
  if (Platform.OS !== "android") {
    return null;
  }
  if (!iap) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      iap = require("expo-iap") as ExpoIap;
    } catch {
      return null;
    }
  }
  return iap;
}

/**
 * `source` separates a real checkout ("purchase") from a store re-sync at
 * launch / manual restore ("restore"): restores re-grant entitlements but must
 * not re-report `support_completed`, or every Plus owner would send the event
 * on every app start. Tips are the exception: a restored tip is by definition
 * still unconsumed (never counted), so it is counted and reported once there.
 */
async function handlePurchase(
  purchase: Purchase,
  source: "purchase" | "restore"
) {
  const lib = loadIap();
  if (!lib || purchase.purchaseState !== "purchased") {
    return;
  }
  const isTip = (TIP_SKUS as readonly string[]).includes(purchase.productId);
  const isPlus = purchase.productId === PLUS_SKU;
  if (!(isPlus || isTip)) {
    return;
  }

  if (isPlus) {
    // Entitlement first: it must not depend on the acknowledge round-trip.
    useSupporterStore.getState().setPlus(true);
    if (source === "purchase") {
      reportSupportCompleted(purchase.productId);
    }
    // Plus is acknowledged once; re-finishing an acknowledged purchase on
    // every restore is a pointless store round-trip.
    if ("isAcknowledgedAndroid" in purchase && purchase.isAcknowledgedAndroid) {
      return;
    }
    await lib.finishTransaction({ isConsumable: false, purchase }).catch(() => {
      // Best effort: an unacknowledged purchase is retried by the next restore.
    });
    return;
  }

  // Tips are consumed so they can be bought again. Count a tip only once its
  // consume succeeded: an unconsumed tip comes back on the next restore, and
  // counting it before (or again after) a failed consume would double count.
  try {
    await lib.finishTransaction({ isConsumable: true, purchase });
  } catch {
    return;
  }
  useSupporterStore.getState().addTip();
  // A tip whose consume failed during checkout is completed by a later
  // restore — that is still the one real purchase, so report it then.
  reportSupportCompleted(purchase.productId);
}

function reportSupportCompleted(product: string) {
  captureAnalyticsEvent("support_completed", {
    placement: "plus",
    product,
    provider: "play_billing",
  });
}

/** Connects once, listens for purchases and restores Plus. Safe to call repeatedly. */
export function initBilling(): Promise<boolean> {
  const lib = loadIap();
  if (!lib) {
    return Promise.resolve(false);
  }
  connected ??= (async () => {
    try {
      await lib.initConnection();
      lib.purchaseUpdatedListener((purchase) => {
        notifyPurchaseUpdate(purchase);
        // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
        void handlePurchase(purchase, "purchase");
      });
      await restorePurchases();
      return true;
    } catch {
      connected = null;
      return false;
    }
  })();
  return connected;
}

/** Re-grants Plus from the store (reinstall / new phone) and finishes stuck tips. */
export async function restorePurchases(): Promise<boolean> {
  const lib = loadIap();
  if (!lib) {
    return false;
  }
  try {
    const purchases = await lib.getAvailablePurchases();
    for (const purchase of purchases) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — finish each Play transaction one at a time
      await handlePurchase(purchase, "restore");
    }
    return purchases.some(
      (p) => p.productId === PLUS_SKU && p.purchaseState === "purchased"
    );
  } catch {
    return false;
  }
}

export async function fetchSupporterProducts(): Promise<Product[]> {
  const lib = loadIap();
  if (!(lib && (await initBilling()))) {
    return [];
  }
  try {
    const products = await lib.fetchProducts({
      skus: ALL_SKUS,
      type: "in-app",
    });
    return (products ?? []) as Product[];
  } catch {
    return [];
  }
}

/**
 * Starts the Play purchase sheet; the result arrives via the purchase
 * listener (see `subscribePurchaseUpdates`). Resolves `false` when the store
 * is unreachable (no native module, offline, not connected).
 */
export async function buySupporterProduct(sku: string): Promise<boolean> {
  const lib = loadIap();
  if (!(lib && (await initBilling()))) {
    return false;
  }
  captureAnalyticsEvent("support_clicked", {
    placement: "plus",
    product: sku,
    provider: "play_billing",
  });
  try {
    await lib.requestPurchase({
      request: { google: { skus: [sku] } },
      type: "in-app",
    });
  } catch {
    // User cancelled or the store refused — nothing to undo.
  }
  return true;
}
