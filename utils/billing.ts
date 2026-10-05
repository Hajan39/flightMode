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

function loadIap(): ExpoIap | null {
	if (Platform.OS !== "android") return null;
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

async function handlePurchase(purchase: Purchase) {
	const lib = loadIap();
	if (!lib || purchase.purchaseState !== "purchased") return;
	const isTip = (TIP_SKUS as readonly string[]).includes(purchase.productId);
	if (purchase.productId === PLUS_SKU) {
		useSupporterStore.getState().setPlus(true);
	} else if (isTip) {
		useSupporterStore.getState().addTip();
	} else {
		return;
	}
	captureAnalyticsEvent("support_completed", {
		placement: "plus",
		provider: "play_billing",
		product: purchase.productId,
	});
	// Tips are consumed so they can be bought again; Plus is acknowledged once.
	await lib.finishTransaction({ purchase, isConsumable: isTip }).catch(() => {});
}

/** Connects once, listens for purchases and restores Plus. Safe to call repeatedly. */
export function initBilling(): Promise<boolean> {
	const lib = loadIap();
	if (!lib) return Promise.resolve(false);
	connected ??= (async () => {
		try {
			await lib.initConnection();
			lib.purchaseUpdatedListener((purchase) => void handlePurchase(purchase));
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
	if (!lib) return false;
	try {
		const purchases = await lib.getAvailablePurchases();
		for (const purchase of purchases) await handlePurchase(purchase);
		return purchases.some(
			(p) => p.productId === PLUS_SKU && p.purchaseState === "purchased",
		);
	} catch {
		return false;
	}
}

export async function fetchSupporterProducts(): Promise<Product[]> {
	const lib = loadIap();
	if (!lib || !(await initBilling())) return [];
	try {
		const products = await lib.fetchProducts({ skus: ALL_SKUS, type: "in-app" });
		return (products ?? []) as Product[];
	} catch {
		return [];
	}
}

/** Starts the Play purchase sheet; the result arrives via the purchase listener. */
export async function buySupporterProduct(sku: string): Promise<void> {
	const lib = loadIap();
	if (!lib || !(await initBilling())) return;
	captureAnalyticsEvent("support_clicked", { placement: "plus", provider: "play_billing", product: sku });
	try {
		await lib.requestPurchase({ request: { google: { skus: [sku] } }, type: "in-app" });
	} catch {
		// User cancelled or the store refused — nothing to undo.
	}
}
