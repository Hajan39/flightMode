import { sanitizeErrorText, stackFunctionNames } from "@/utils/errorLogging";

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

  test("JSC frames and the frame cap", () => {
    const stack = Array.from(
      { length: 8 },
      (_, i) => `fn${i}@/var/mobile/app/main.jsbundle:1:${i}`
    ).join("\n");
    expect(stackFunctionNames(stack)).toBe("fn0 < fn1 < fn2 < fn3 < fn4");
    expect(stackFunctionNames(undefined)).toBe("");
  });
});
