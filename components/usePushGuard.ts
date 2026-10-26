import { type Href, useRouter } from "expo-router";
import { useCallback } from "react";

import { createPushGuard } from "@/components/pushGuard";

// One gate for the whole app: two different cards tapped in the same burst
// must not push two screens either.
const allowPush = createPushGuard();

/**
 * `router.push` that ignores a repeated navigation within ~600 ms. Use it
 * for cards, rows and tiles that open a screen.
 */
export function usePushGuard() {
  const router = useRouter();
  return useCallback(
    (href: Href | string) => {
      if (allowPush()) {
        router.push(href as Href);
      }
    },
    [router]
  );
}
