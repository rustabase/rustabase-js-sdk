import { expect, it } from "vitest";
import { joinUrl } from "../../src";
it("normalizes server URL slashes", () =>
    expect(joinUrl("https://x.test///", "///api/health")).toBe(
        "https://x.test/api/health",
    ));
