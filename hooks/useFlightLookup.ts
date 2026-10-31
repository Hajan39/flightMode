import { useRef, useState } from "react";

import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  type FlightLookupAvailability,
  type FlightLookupError,
  flightLookupAnalyticsResult,
  getFlightLookupAvailability,
  isFlightLookupEnabled,
  lookupFlight,
} from "@/utils/flightLookup";
import {
  type FlightFormField,
  type FlightFormFill,
  fieldsToApply,
  mapLookupToForm,
} from "@/utils/flightLookupFill";

export type FlightLookupStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "filled"; from: string; to: string }
  | { kind: "failed"; error: FlightLookupError };

export type FlightFormPatch = Partial<Omit<FlightFormFill, "route">>;

/** Build-time env flag: constant for the lifetime of the app. */
const LOOKUP_ENABLED = isFlightLookupEnabled();

/**
 * State machine behind the flight editor's optional "Fill in" button.
 *
 * - `run()` looks the flight up and hands the fields to `apply`, except those
 *   the user changed while it was running (`markTouched`).
 * - `reset()` (on flight-number edits) drops a pending answer.
 * - A filled form is never refilled on its own: only another tap does that.
 */
export function useFlightLookup(apply: (patch: FlightFormPatch) => void) {
  const [status, setStatus] = useState<FlightLookupStatus>({ kind: "idle" });
  /** Bumped per lookup and on reset: stale answers are dropped. */
  const seqRef = useRef(0);
  /** Fields the user changed while the current lookup was running. */
  const touchedRef = useRef(new Set<FlightFormField>());
  const syncPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const networkType = useNetworkStore((s) => s.type);

  const availability: FlightLookupAvailability = LOOKUP_ENABLED
    ? getFlightLookupAvailability(
        { isInternetReachable, type: networkType },
        syncPolicy
      )
    : "disabled";

  const markTouched = (field: FlightFormField) => {
    touchedRef.current.add(field);
  };

  const reset = () => {
    if (status.kind !== "idle") {
      seqRef.current += 1;
      setStatus({ kind: "idle" });
    }
  };

  const run = async (flightNumber: string, date: string) => {
    if (status.kind === "loading") {
      return;
    }
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    touchedRef.current = new Set();
    setStatus({ kind: "loading" });

    const result = await lookupFlight(flightNumber, date);
    if (seqRef.current !== seq) {
      return; // flight number edited meanwhile
    }
    const analyticsResult = flightLookupAnalyticsResult(result);
    if (analyticsResult) {
      // Coarse outcome only — never the flight number or the date.
      captureAnalyticsEvent("flight_lookup_result", {
        result: analyticsResult,
      });
    }
    const fill = result.ok ? mapLookupToForm(result.flight) : null;
    if (!fill) {
      setStatus({ error: result.ok ? "error" : result.error, kind: "failed" });
      return;
    }
    apply(fieldsToApply(fill, touchedRef.current));
    setStatus({ from: fill.route.from, kind: "filled", to: fill.route.to });
  };

  return {
    availability,
    enabled: LOOKUP_ENABLED,
    markTouched,
    reset,
    run,
    status,
  };
}
