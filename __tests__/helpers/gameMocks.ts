/**
 * Module mocks shared by the game smoke tests. Import this module FIRST in a
 * test file: `jest.mock` registers each mock when this module is evaluated,
 * i.e. before the games (loaded lazily via `loadComponent`) require them.
 * Only native / platform modules are replaced; every shared game component
 * (PlayerSetup, overlays, GameResult …) stays real.
 */
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  const RN = jest.requireActual("react-native");
  const strip = (C: any) => {
    const Wrapped = React.forwardRef((props: any, ref: any) =>
      React.createElement(C, {
        ...props,
        entering: undefined,
        exiting: undefined,
        layout: undefined,
        ref,
      })
    );
    return Wrapped;
  };
  const chain: any = new Proxy(() => chain, { get: () => () => chain });
  const Animated = {
    createAnimatedComponent: strip,
    Image: strip(RN.Image),
    ScrollView: strip(RN.ScrollView),
    Text: strip(RN.Text),
    View: strip(RN.View),
  };
  const useSharedValue = (v: unknown) => {
    const ref = React.useRef(null);
    if (ref.current === null) {
      const sv: any = { value: v };
      sv.get = () => sv.value;
      sv.set = (n: any) => {
        sv.value = typeof n === "function" ? n(sv.value) : n;
      };
      ref.current = sv;
    }
    return ref.current;
  };
  return {
    __esModule: true,
    ...Animated,
    cancelAnimation: () => undefined,
    default: Animated,
    Easing: chain,
    FadeIn: chain,
    FadeInDown: chain,
    FadeOut: chain,
    FadeOutLeft: chain,
    LinearTransition: chain,
    runOnJS: (f: any) => f,
    SlideInDown: chain,
    SlideInRight: chain,
    SlideOutDown: chain,
    useAnimatedStyle: (f: () => object) => f(),
    useSharedValue,
    withDelay: (_d: number, a: unknown) => a,
    withRepeat: (a: unknown) => a,
    withSequence: (...a: unknown[]) => a.at(-1),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    ZoomIn: chain,
  };
});
// The test renderer has no native view tags. RN's Animated tolerates that only
// when NODE_ENV is "test"; the React Compiler (production) transform inlines
// NODE_ENV, so `useNativeDriver: true` would throw there. Give it a dummy tag.
jest.mock("react-native/Libraries/ReactNative/RendererProxy", () => {
  const actual = jest.requireActual(
    "react-native/Libraries/ReactNative/RendererProxy"
  );
  return {
    ...actual,
    findNodeHandle: (x: unknown) => actual.findNodeHandle(x) ?? -1,
  };
});
jest.mock("expo-router", () => ({
  useFocusEffect: () => undefined,
  useNavigation: () => ({
    addListener: () => () => undefined,
    setOptions: () => undefined,
  }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("expo-sensors", () => {
  const sensor = () => ({
    addListener: () => ({ remove: () => undefined }),
    isAvailableAsync: () => Promise.resolve(true),
    removeAllListeners: () => undefined,
    setUpdateInterval: () => undefined,
  });
  return { Accelerometer: sensor(), DeviceMotion: sensor() };
});
jest.mock("@expo/vector-icons", () => {
  const RN = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  const Icon = (p: { name: string }) =>
    React.createElement(RN.Text, null, `icon:${p.name}`);
  return new Proxy({}, { get: () => Icon });
});
jest.mock("@/hooks/useAutoPause", () => ({ useAutoPause: () => undefined }));
// Keys come back verbatim; interpolation params are appended so labels such
// as `a11yRowCol(col=2,row=3)` stay distinguishable for the drivers.
jest.mock("@/hooks/useTranslation", () => {
  const t = (k: string, p?: Record<string, unknown>) =>
    p
      ? `${k}(${Object.keys(p)
          .sort()
          .map((key) => `${key}=${String(p[key])}`)
          .join(",")})`
      : k;
  return { useTranslation: () => ({ language: "en", t }) };
});
