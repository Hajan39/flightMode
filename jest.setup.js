// Mock AsyncStorage so stores that persist (useGameStore, useSettingsStore, …)
// can be imported and exercised in pure unit tests.
jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
