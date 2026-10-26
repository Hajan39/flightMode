import type { Product, Purchase } from "expo-iap";
import { Platform } from "react-native";

import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { runAfterHydration } from "@/utils/hydration";
import { onPersistRecoveryGaveUp } from "@/utils/persistStorage";

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
    // A write before the supporter store hydrated would be overwritten by the
    // stored state (and is dropped on disk), so it waits for hydration. Plus
    // is non-consumable: if hydration never finishes this session, the next
    // restore grants it again.
    runAfterHydration(
      useSupporterStore,
      () => useSupporterStore.getState().setPlus(true),
      { timeoutMs: null }
    );
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

  // The same tip can arrive twice (a restore and the purchase listener, or a
  // call queued before hydration and another after it): only one consume per
  // purchase may be in flight, or both would count it.
  const key = purchaseKey(purchase);
  if (key !== null && pendingTips.has(key)) {
    return; // already being consumed / queued by an earlier call
  }
  if (key !== null) {
    pendingTips.add(key);
  }
  const release = () => {
    if (key !== null) {
      pendingTips.delete(key);
    }
  };

  if (useSupporterStore.persist.hasHydrated()) {
    await consumeTip(lib, purchase).finally(release);
    return;
  }
  // Not hydrated yet: a tip counted now would be lost (hydration overwrites
  // it), and once consumed Play never returns it. So the consume itself waits
  // for hydration. Not awaited, so a slow hydration doesn't stall the restore
  // loop / initBilling.
  // If the store's read was blocked and its background recovery failed (or
  // was skipped), it won't hydrate this session: an unconsumed tip would be
  // auto-refunded by Play after 3 days if the next launch is late or fails
  // the same way, so it is consumed anyway and only the local tip counter
  // misses it (a cosmetic number; the purchase itself is never lost).
  let settled = false;
  const cleanups: (() => void)[] = [];
  const settle = (count: boolean) => {
    if (settled) {
      return;
    }
    settled = true;
    for (const cleanup of cleanups) {
      cleanup();
    }
    // biome-ignore lint/complexity/noVoid: fire-and-forget; consumeTip never rejects
    void consumeTip(lib, purchase, { count }).finally(release);
  };
  cleanups.push(
    runAfterHydration(useSupporterStore, () => settle(true), {
      timeoutMs: null,
    })
  );
  // Fires right away when the give-up is already known (the hydration
  // waiter above is then cancelled by `settle`).
  cleanups.push(
    onPersistRecoveryGaveUp(SUPPORTER_STORE_NAME, () => settle(false))
  );
}

/** `persist` name of the supporter store (see store/useSupporterStore.ts). */
const SUPPORTER_STORE_NAME = "supporter";

/** Tips queued for hydration or being consumed (by purchase identity). */
const pendingTips = new Set<string>();

/**
 * Identity for de-duping queued tips: the Play purchase token, else the order
 * id, else the transaction time. `null` (nothing identifying) skips de-dupe —
 * a duplicate consume of the same purchase just fails and isn't counted,
 * while a shared fallback key would drop a second, distinct tip.
 */
function purchaseKey(purchase: Purchase): string | null {
  const identity =
    purchase.purchaseToken ||
    purchase.id ||
    (purchase.transactionDate ? `t${purchase.transactionDate}` : "");
  return identity ? `${purchase.productId}:${identity}` : null;
}

/**
 * Tips are consumed so they can be bought again. Count a tip only once its
 * consume succeeded: an unconsumed tip comes back on the next restore, and
 * counting it before (or again after) a failed consume would double count.
 * Call only once the supporter store has hydrated — or with `count: false`
 * when it never will this session (see `handlePurchase`).
 */
async function consumeTip(
  lib: ExpoIap,
  purchase: Purchase,
  { count = true }: { count?: boolean } = {}
) {
  try {
    await lib.finishTransaction({ isConsumable: true, purchase });
  } catch {
    return;
  }
  if (count) {
    useSupporterStore.getState().addTip();
  }
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
