jest.mock("@/utils/analytics", () => ({ captureAnalyticsEvent: jest.fn() }));

import { useContentStore } from "@/store/useContentStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";

describe("content sync after a failure", () => {
	test("does not refetch in a loop when the feed request fails", async () => {
		useSettingsStore.setState({ syncNetworkPolicy: "wifi_and_mobile" });
		useNetworkStore.setState({ type: "wifi", isInternetReachable: true } as never);
		const fetchMock = jest.fn(async () => ({ ok: false, status: 404 }));
		global.fetch = fetchMock as never;

		await useContentStore.getState().syncContent();
		expect(useContentStore.getState().status).toBe("error");
		// The bootstrap effect re-runs on every status change — these must be no-ops.
		await useContentStore.getState().syncContent();
		await useContentStore.getState().syncContent();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
