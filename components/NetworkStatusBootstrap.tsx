import {
  addNetworkStateListener,
  getNetworkStateAsync,
  type NetworkState,
  NetworkStateType,
} from "expo-network";
import { useEffect, useRef } from "react";

import {
  type NetworkConnectionType,
  useNetworkStore,
} from "@/store/useNetworkStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

type NetworkSource = "initial" | "listener";

function normalizeNetworkType(type?: NetworkStateType) {
  return (type ?? NetworkStateType.UNKNOWN) as NetworkConnectionType;
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

    const applyNetworkState = (state: NetworkState, source: NetworkSource) => {
      const nextState = {
        isConnected: state.isConnected ?? null,
        isInternetReachable: state.isInternetReachable ?? null,
        type: normalizeNetworkType(state.type),
      };
      const nextKey = buildNetworkKey(nextState);

      setNetworkState(nextState);

      if (lastNetworkKeyRef.current === nextKey) {
        return;
      }
      lastNetworkKeyRef.current = nextKey;

      captureAnalyticsEvent("network_status_changed", {
        is_connected: nextState.isConnected,
        is_internet_reachable: nextState.isInternetReachable,
        network_type: nextState.type,
        source,
      });
    };

    getNetworkStateAsync()
      .then((state) => {
        if (isMounted) {
          applyNetworkState(state, "initial");
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        applyNetworkState(
          {
            type: NetworkStateType.UNKNOWN,
          },
          "initial"
        );
      });

    const subscription = addNetworkStateListener((state) => {
      applyNetworkState(state, "listener");
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [setNetworkState]);

  return null;
}
