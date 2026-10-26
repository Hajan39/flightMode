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

/** Give-up listeners per store name (`onPersistRecoveryGaveUp`), test-driven. */
const mockGaveUp = new Map<string, Set<() => void>>();
jest.mock("@/utils/persistStorage", () => ({
  ...jest.requireActual("@/utils/persistStorage"),
  onPersistRecoveryGaveUp: (name: string, fn: () => void) => {
    const set = mockGaveUp.get(name) ?? new Set();
    mockGaveUp.set(name, set);
    set.add(fn);
    return () => set.delete(fn);
  },
}));
const giveUpRecovery = (name: string) => {
  for (const fn of [...(mockGaveUp.get(name) ?? [])]) {
    fn();
  }
};

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

describe("billing before the supporter store hydrated", () => {
  let hydrated = false;
  let finishListeners: (() => void)[] = [];
  let hasHydratedSpy: jest.SpyInstance;
  let onFinishSpy: jest.SpyInstance;

  /** Simulates zustand finishing hydration: stored state merged, then listeners. */
  const finishHydration = (stored: { plus: boolean; tips: number }) => {
    useSupporterStore.setState(stored);
    hydrated = true;
    for (const listener of finishListeners) {
      listener();
    }
    finishListeners = [];
  };
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    useSupporterStore.setState({ plus: false, tips: 0 });
    mockFinishTransaction.mockClear();
    hydrated = false;
    finishListeners = [];
    mockGaveUp.clear();
    hasHydratedSpy = jest
      .spyOn(useSupporterStore.persist, "hasHydrated")
      .mockImplementation(() => hydrated);
    onFinishSpy = jest
      .spyOn(useSupporterStore.persist, "onFinishHydration")
      .mockImplementation((listener) => {
        finishListeners.push(listener as () => void);
        return () => {
          finishListeners = finishListeners.filter((l) => l !== listener);
        };
      });
  });

  afterEach(() => {
    hasHydratedSpy.mockRestore();
    onFinishSpy.mockRestore();
  });

  test("Plus restored before hydration is granted once hydration finished", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "flightmode_plus", purchaseState: "purchased" },
    ]);
    expect(await restorePurchases()).toBe(true);
    finishHydration({ plus: false, tips: 3 });
    expect(useSupporterStore.getState()).toMatchObject({ plus: true, tips: 3 });
  });

  test("a tip is consumed and counted only after hydration, on top of the stored count", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: "tip_small",
        purchaseState: "purchased",
        purchaseToken: "tok-1",
      },
    ]);
    // Two restores before hydration (launch + manual): queued once.
    await restorePurchases();
    await restorePurchases();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
    finishHydration({ plus: false, tips: 2 });
    await flush();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(useSupporterStore.getState().tips).toBe(3);
  });

  test("without hydration a tip is never consumed (it comes back on the next restore)", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "tip_large", purchaseState: "purchased" },
    ]);
    await restorePurchases();
    await flush();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
    expect(useSupporterStore.getState().tips).toBe(0);
  });

  test("a store that won't hydrate this session still gets its tip consumed (counter skipped)", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: "tip_small",
        purchaseState: "purchased",
        purchaseToken: "tok-gaveup",
      },
    ]);
    await restorePurchases();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
    giveUpRecovery("supporter"); // blocked read + failed/skipped re-read
    await flush();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: true })
    );
    expect(useSupporterStore.getState().tips).toBe(0); // no write to a blocked store
    // A late hydration doesn't consume / count it a second time.
    finishHydration({ plus: false, tips: 2 });
    await flush();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(useSupporterStore.getState().tips).toBe(2);
  });

  test("a tip queued before hydration and delivered again after it is consumed once", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: "tip_large",
        purchaseState: "purchased",
        purchaseToken: "tok-twice",
      },
    ]);
    let finishConsume: () => void = () => undefined;
    mockFinishTransaction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishConsume = resolve;
        })
    );
    await restorePurchases(); // queued: store not hydrated yet
    finishHydration({ plus: false, tips: 1 });
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1); // consume in flight
    // The same purchase arrives again on the hydrated path (listener / restore).
    const second = restorePurchases();
    finishConsume();
    await second;
    await flush();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(useSupporterStore.getState().tips).toBe(2);
  });

  test("the same tip delivered twice once hydrated is consumed once", async () => {
    hydrated = true;
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: "tip_small",
        purchaseState: "purchased",
        purchaseToken: "tok-hydrated",
      },
    ]);
    let finishConsume: () => void = () => undefined;
    mockFinishTransaction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishConsume = resolve;
        })
    );
    const first = restorePurchases();
    await flush();
    const second = restorePurchases();
    await flush();
    finishConsume();
    await Promise.all([first, second]);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(useSupporterStore.getState().tips).toBe(1);
  });

  test("tips without a token or order id are not merged into one queue entry", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: "tip_small", purchaseState: "purchased" },
      { productId: "tip_small", purchaseState: "purchased" },
    ]);
    await restorePurchases();
    finishHydration({ plus: false, tips: 0 });
    await flush();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(2);
    expect(useSupporterStore.getState().tips).toBe(2);
  });

  test("the transaction date de-dupes a tip that has no token or order id", async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: "tip_medium",
        purchaseState: "purchased",
        transactionDate: 1_700_000_000_000,
      },
    ]);
    await restorePurchases();
    await restorePurchases();
    finishHydration({ plus: false, tips: 0 });
    await flush();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(useSupporterStore.getState().tips).toBe(1);
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
