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

  test("a store failure keeps the cached entitlement", async () => {
    useSupporterStore.setState({ plus: true });
    mockGetAvailablePurchases.mockRejectedValue(new Error("offline"));
    expect(await restorePurchases()).toBe(false);
    expect(useSupporterStore.getState().plus).toBe(true);
  });
});

describe("review prompt gate", () => {
  const day = 24 * 60 * 60 * 1000;
  test("asks engaged users at most every 60 days", () => {
    expect(shouldAskForReview(2, null, 0)).toBe(false);
    expect(shouldAskForReview(3, null, 0)).toBe(true);
    expect(shouldAskForReview(5, 0, 59 * day)).toBe(false);
    expect(shouldAskForReview(5, 0, 60 * day)).toBe(true);
  });
});
