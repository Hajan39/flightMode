import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { View as RNView, type StyleProp, type ViewStyle } from "react-native";

/**
 * Screen-reader isolation for in-game overlays (pass-device hand-off, pause,
 * results).
 *
 * iOS: overlays set `accessibilityViewIsModal`, which makes VoiceOver ignore
 * their siblings. Android has no equivalent — TalkBack keeps reading (and
 * focusing) the board underneath, which defeats "Don't peek" hand-offs. The
 * fix on Android is `importantForAccessibility="no-hide-descendants"` on the
 * *content* sibling, which the overlay cannot reach on its own.
 *
 * Usage in a game (the overlay stays a sibling of the content, so it is not
 * hidden itself):
 *
 *   <A11yOverlayScope>
 *     <A11yOverlayContent style={styles.board}>…board…</A11yOverlayContent>
 *     <PassDeviceOverlay visible={handOff} … />
 *   </A11yOverlayScope>
 *
 * Every shared overlay calls `useA11yOverlay(visible)`; outside a scope the
 * hook is a no-op, so existing games keep working unchanged.
 */

interface ScopeValue {
  hidden: boolean;
  register: () => () => void;
}

const A11yOverlayContext = createContext<ScopeValue | null>(null);

export function A11yOverlayScope({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const register = useCallback(() => {
    setCount((c) => c + 1);
    return () => setCount((c) => Math.max(0, c - 1));
  }, []);

  const value = useMemo(
    () => ({ hidden: count > 0, register }),
    [count, register]
  );

  return (
    <A11yOverlayContext.Provider value={value}>
      {children}
    </A11yOverlayContext.Provider>
  );
}

/** Wraps the game content that must be hidden from TalkBack / VoiceOver while an overlay is up. */
export function A11yOverlayContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const hidden = useContext(A11yOverlayContext)?.hidden ?? false;
  return (
    <RNView
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={style}
    >
      {children}
    </RNView>
  );
}

/** Called by overlays: while `visible`, the scope's content is hidden from assistive tech. */
export function useA11yOverlay(visible: boolean) {
  const register = useContext(A11yOverlayContext)?.register;
  useEffect(() => {
    if (!(visible && register)) {
      return;
    }
    return register();
  }, [visible, register]);
}
