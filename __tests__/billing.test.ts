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
import { restorePurchases } from "@/utils/billing";
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
