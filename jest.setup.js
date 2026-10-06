// Mock AsyncStorage so stores that persist (useGameStore, useSettingsStore, …)
// can be imported and exercised in pure unit tests.
// biome-ignore lint/correctness/noUndeclaredVariables: `jest` is a global injected by the Jest runtime in setup files
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
