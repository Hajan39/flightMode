import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  logFatalError,
  sanitizeErrorText,
  stackFunctionNames,
} from "@/utils/errorLogging";

jest.mock("@/utils/analytics", () => ({ captureAnalyticsEvent: jest.fn() }));

describe("sanitizeErrorText", () => {
  test("keeps short technical codes", () => {
    expect(sanitizeErrorText("rates http 503")).toBe("rates http 503");
    expect(sanitizeErrorText("Content sync failed with status 404")).toBe(
      "Content sync failed with status 404"
    );
    expect(sanitizeErrorText("Network request failed")).toBe(
      "Network request failed"
    );
  });

  test("strips URLs (incl. query strings)", () => {
    const out = sanitizeErrorText(
      "Failed to load https://example.com/a/b?token=secret&user=me now"
    );
    expect(out).toBe("Failed to load url now");
    expect(out).not.toContain("secret");
  });

  test("strips file paths", () => {
    const out = sanitizeErrorText(
      "ENOENT: no such file /data/user/0/com.hajan39.flightmode/files/x.json"
    );
    expect(out).not.toContain("/data");
    expect(out).not.toContain("com.hajan39");
    expect(out).toContain("path");
    expect(sanitizeErrorText("open C:\\Users\\jan\\a.txt failed")).toBe(
      "open path failed"
    );
  });

  test("strips JSON, quotes, e-mails and long digit runs", () => {
    expect(sanitizeErrorText('Bad payload {"name":"Jan","seat":"12A"}')).toBe(
      "Bad payload json"
    );
    expect(sanitizeErrorText("Unknown key 'Jan Novak' in map")).toBe(
      "Unknown key str in map"
    );
    expect(sanitizeErrorText("mail jan@example.com bounced")).toBe(
      "mail email bounced"
    );
    expect(sanitizeErrorText("id 1234567890 vs 1234")).toBe("id n vs 1234");
    // 5 digits is already a "long run" (postcodes, PINs); 4 stays (HTTP codes, years).
    expect(sanitizeErrorText("zip 12345 code 2026")).toBe("zip n code 2026");
  });

  test("caps length at 80 and handles non-strings", () => {
    expect(sanitizeErrorText("x ".repeat(200)).length).toBeLessThanOrEqual(80);
    expect(sanitizeErrorText(undefined)).toBe("");
    expect(sanitizeErrorText(42)).toBe("");
  });
});

describe("stackFunctionNames", () => {
  test("Hermes/V8 frames → names only, no paths or line numbers", () => {
    const stack = [
      "TypeError: Cannot read property 'x' of undefined",
      "    at renderGame (http://10.0.0.2:8081/index.bundle?platform=android:1234:56)",
      "    at Object.call (/data/app/index.android.bundle:1:2)",
      "    at http://10.0.0.2:8081/index.bundle:99:1",
      "    at new Board (index.bundle:1:1)",
    ].join("\n");
    const out = stackFunctionNames(stack);
    expect(out).toBe("renderGame < Object.call < anonymous < Board");
    expect(out).not.toContain("/");
    expect(out).not.toContain(":");
  });

  test("non-identifier frame names collapse to anonymous; long names are capped", () => {
    const long = `f${"x".repeat(80)}`;
    const stack = [
      "    at Object.<anonymous> (/data/app/index.bundle:1:2)",
      `    at ${long} (index.bundle:1:1)`,
      "onPress@/var/app/main.jsbundle:1:1",
    ].join("\n");
    expect(stackFunctionNames(stack)).toBe(
      `anonymous < ${long.slice(0, 60)} < onPress`
    );
  });

  test("JSC frames and the frame cap", () => {
    const stack = Array.from(
      { length: 8 },
      (_, i) => `fn${i}@/var/mobile/app/main.jsbundle:1:${i}`
    ).join("\n");
    expect(stackFunctionNames(stack)).toBe("fn0 < fn1 < fn2 < fn3 < fn4");
    expect(stackFunctionNames(undefined)).toBe("");
  });
});

describe("logFatalError analytics payload", () => {
  const capture = captureAnalyticsEvent as jest.Mock;
  beforeEach(() => {
    capture.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("every field is sanitized — no URLs, paths, quotes or user text", () => {
    const err = new Error(
      "Failed https://api.example.com/x?token=secret for 'Jan Novak'"
    );
    err.name = 'Bad"Name/at /home/jan/app.js';
    err.stack = "Error\n    at loadRates (/data/app/index.bundle:1:2)";
    logFatalError(err, "global", "screen /data/user/0/x.json");

    expect(capture).toHaveBeenCalledTimes(1);
    const [event, payload] = capture.mock.calls[0];
    expect(event).toBe("app_error");
    expect(payload).toEqual({
      context: "screen path",
      error_code: "Failed url for str",
      error_name: "BadName path path",
      source: "global",
      stack_head: "loadRates",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("Jan");
    expect(serialized).not.toContain("/home");
    expect(serialized).not.toContain("/data");
  });

  test("missing context is null; an unsanitizable name falls back to Error", () => {
    const err = new Error("boom");
    err.name = "'Jan'";
    logFatalError(err, "render");
    const [[, payload]] = capture.mock.calls;
    expect(payload.context).toBeNull();
    expect(payload.error_name).toBe("str");
    expect(payload.error_code).toBe("boom");

    capture.mockClear();
    const quoted = new Error("x");
    quoted.name = "<>";
    logFatalError(quoted, "promise");
    expect(capture.mock.calls[0][1].error_name).toBe("Error");
  });

  test("error_name is capped at 40 chars", () => {
    const err = new Error("x");
    err.name = "N".repeat(70);
    logFatalError(err, "global");
    expect(capture.mock.calls[0][1].error_name).toBe("N".repeat(40));
  });
});
