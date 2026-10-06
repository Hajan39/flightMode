import { useEffect } from "react";

import { initBilling } from "@/utils/billing";

/**
 * Connects Play Billing once on launch so a Plus purchase is restored on a new
 * phone and purchases completed while the app was closed get finished.
 * Guarded no-op without the native module (Expo Go, iOS, web).
 */
export default function BillingBootstrap() {
  useEffect(() => {
    void initBilling();
  }, []);

  return null;
}
