const mockFiles = new Map<string, string>();
jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: async (uri: string) => void mockFiles.delete(uri),
  documentDirectory: "file:///docs/",
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri) }),
  readAsStringAsync: async (uri: string) => mockFiles.get(uri),
  writeAsStringAsync: async (uri: string, value: string) =>
    void mockFiles.set(uri, value),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { fileStorage } from "@/utils/fileStorage";

describe("fileStorage", () => {
  test("migrates a value from AsyncStorage into a file on first read", async () => {
    await AsyncStorage.setItem("content_sync", '{"state":{"items":[]}}');
    expect(await fileStorage.getItem("content_sync")).toBe(
      '{"state":{"items":[]}}'
    );
    expect(mockFiles.get("file:///docs/persist_content_sync.json")).toBe(
      '{"state":{"items":[]}}'
    );
    expect(await AsyncStorage.getItem("content_sync")).toBeNull();
  });

  test("round-trips through the file and removes it", async () => {
    await fileStorage.setItem("k", "v");
    expect(await fileStorage.getItem("k")).toBe("v");
    await fileStorage.removeItem("k");
    expect(await fileStorage.getItem("k")).toBeNull();
  });
});
