import * as Network from "expo-network";
import { useEffect, useRef } from "react";

import {
    useNetworkStore,
    type NetworkConnectionType,
} from "@/store/useNetworkStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

type NetworkSource = "initial" | "listener";

function normalizeNetworkType(type?: Network.NetworkStateType) {
	return (type ?? Network.NetworkStateType.UNKNOWN) as NetworkConnectionType;
}

function buildNetworkKey(state: {
	type: NetworkConnectionType;
	isConnected: boolean | null;
	isInternetReachable: boolean | null;
}) {
	return `${state.type}:${state.isConnected}:${state.isInternetReachable}`;
}

export default function NetworkStatusBootstrap() {
	const setNetworkState = useNetworkStore((state) => state.setNetworkState);
	const lastNetworkKeyRef = useRef<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		const applyNetworkState = (
			state: Network.NetworkState,
			source: NetworkSource,
		) => {
			const nextState = {
				type: normalizeNetworkType(state.type),
				isConnected: state.isConnected ?? null,
				isInternetReachable: state.isInternetReachable ?? null,
			};
			const nextKey = buildNetworkKey(nextState);

			setNetworkState(nextState);

			if (lastNetworkKeyRef.current === nextKey) return;
			lastNetworkKeyRef.current = nextKey;

			captureAnalyticsEvent("network_status_changed", {
				source,
				network_type: nextState.type,
				is_connected: nextState.isConnected,
				is_internet_reachable: nextState.isInternetReachable,
			});
		};

		Network.getNetworkStateAsync()
			.then((state) => {
				if (isMounted) applyNetworkState(state, "initial");
			})
			.catch(() => {
				if (!isMounted) return;

				applyNetworkState(
					{
						type: Network.NetworkStateType.UNKNOWN,
					},
					"initial",
				);
			});

		const subscription = Network.addNetworkStateListener((state) => {
			applyNetworkState(state, "listener");
		});

		return () => {
			isMounted = false;
			subscription.remove();
		};
	}, [setNetworkState]);

	return null;
}
