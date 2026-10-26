jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
jest.mock("@/utils/analytics", () => ({ captureAnalyticsEvent: jest.fn() }));

const mockFinishTransaction = jest.fn(() => Promise.resolve());
const mockGetAvailablePurchases = jest.fn();
jest.mock("expo-iap", () => ({
  finishTransaction: mockFinishTransaction,
  getAvailablePurchases: mockGetAvailablePurchases,
  initConnection: jest.fn(() => Promise.resolve(true)),
  purchaseUpdatedListener: jest.fn(),
}));

import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  initBilling,
  restorePurchases,
  subscribePurchaseUpdates,
} from "@/utils/billing";
import { shouldAskForReview } from "@/utils/reviewPrompt";

describe("billing entitlement", () => {
  beforeEach(() => {
    useSupporterStore.setState({ plus: false, tips: 0 });
    mockFinishTransaction.mockClear();
  });

  test("a purchased Plus is restored and acknowledged, never consumed", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "flightmode_plus", purchaseState: "purchased" },
    ]);
    expect(await restorePurchases()).toBe(true);
    expect(useSupporterStore.getState().plus).toBe(true);
    expect(mockFinishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: false })
    );
  });

  test("tips are counted and consumed; pending and unknown products grant nothing", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "tip_small", purchaseState: "purchased" },
      { productId: "flightmode_plus", purchaseState: "pending" },
      { productId: "something_else", purchaseState: "purchased" },
    ]);
    expect(await restorePurchases()).toBe(false);
    expect(useSupporterStore.getState()).toMatchObject({
      plus: false,
      tips: 1,
    });
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: true })
    );
  });

  test("a tip whose consume fails is not counted; the restore that consumes it counts it once", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "tip_medium", purchaseState: "purchased" },
    ]);
    mockFinishTransaction.mockImplementationOnce(() =>
      Promise.reject(new Error("consume failed"))
    );
    await restorePurchases();
    expect(useSupporterStore.getState().tips).toBe(0);

    await restorePurchases();
    expect(useSupporterStore.getState().tips).toBe(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(2);
  });

  test("a Plus acknowledge failure still grants the entitlement", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "flightmode_plus", purchaseState: "purchased" },
    ]);
    mockFinishTransaction.mockImplementationOnce(() =>
      Promise.reject(new Error("ack failed"))
    );
    expect(await restorePurchases()).toBe(true);
    expect(useSupporterStore.getState().plus).toBe(true);
  });

  test("a store failure keeps the cached entitlement", async () => {
    useSupporterStore.setState({ plus: true });
    mockGetAvailablePurchases.mockRejectedValue(new Error("offline"));
    expect(await restorePurchases()).toBe(false);
    expect(useSupporterStore.getState().plus).toBe(true);
  });
});

describe("billing acknowledge + support_completed reporting", () => {
  const capture = captureAnalyticsEvent as jest.Mock;
  const completed = () =>
    capture.mock.calls.filter((c) => c[0] === "support_completed");

  beforeEach(() => {
    useSupporterStore.setState({ plus: false, tips: 0 });
    mockFinishTransaction.mockClear();
    capture.mockClear();
  });

  test("an already-acknowledged Plus is re-granted without another finish", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      {
        isAcknowledgedAndroid: true,
        productId: "flightmode_plus",
        purchaseState: "purchased",
      },
    ]);
    expect(await restorePurchases()).toBe(true);
    expect(useSupporterStore.getState().plus).toBe(true);
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  test("restoring Plus never re-reports support_completed", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "flightmode_plus", purchaseState: "purchased" },
    ]);
    await restorePurchases();
    await restorePurchases();
    expect(completed()).toHaveLength(0);
  });

  test("a restored (stuck) tip is reported once it is consumed — not when consume fails", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "tip_large", purchaseState: "purchased" },
    ]);
    mockFinishTransaction.mockImplementationOnce(() =>
      Promise.reject(new Error("consume failed"))
    );
    await restorePurchases();
    expect(completed()).toHaveLength(0);
    await restorePurchases();
    expect(completed()).toHaveLength(1);
    expect(completed()[0][1]).toEqual({
      placement: "plus",
      product: "tip_large",
      provider: "play_billing",
    });
  });

  test("a live Plus checkout reports support_completed once", async () => {
    mockGetAvailablePurchases.mockResolvedValue([]);
    await initBilling();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iap = require("expo-iap") as { purchaseUpdatedListener: jest.Mock };
    const [[listener]] = iap.purchaseUpdatedListener.mock.calls;
    listener({ productId: "flightmode_plus", purchaseState: "purchased" });
    await new Promise((resolve) => setImmediate(resolve));
    expect(useSupporterStore.getState().plus).toBe(true);
    expect(completed()).toHaveLength(1);
    expect(completed()[0][1].product).toBe("flightmode_plus");
  });

  test("a pending checkout is reported to screen listeners without granting Plus", async () => {
    useSupporterStore.setState({ plus: false, tips: 0 });
    mockGetAvailablePurchases.mockResolvedValue([]);
    await initBilling();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iap = require("expo-iap") as { purchaseUpdatedListener: jest.Mock };
    const [[listener]] = iap.purchaseUpdatedListener.mock.calls;
    const updates: string[] = [];
    const unsubscribe = subscribePurchaseUpdates((productId, update) =>
      updates.push(`${productId}:${update}`)
    );
    listener({ productId: "flightmode_plus", purchaseState: "pending" });
    await new Promise((resolve) => setImmediate(resolve));
    unsubscribe();
    listener({ productId: "flightmode_plus", purchaseState: "pending" });
    expect(updates).toEqual(["flightmode_plus:pending"]);
    expect(useSupporterStore.getState().plus).toBe(false);
  });
});

describe("review prompt gate", () => {
  const day = 24 * 60 * 60 * 1000;
  test("asks engaged users only, Later waits 30 days, done is final", () => {
    expect(shouldAskForReview(3, 20, null, false, 0)).toBe(false);
    expect(shouldAskForReview(4, 7, null, false, 0)).toBe(false);
    expect(shouldAskForReview(4, 8, null, false, 0)).toBe(true);
    expect(shouldAskForReview(9, 30, 0, false, 29 * day)).toBe(false);
    expect(shouldAskForReview(9, 30, 0, false, 30 * day)).toBe(true);
    expect(shouldAskForReview(9, 30, null, true, 365 * day)).toBe(false);
  });
});
