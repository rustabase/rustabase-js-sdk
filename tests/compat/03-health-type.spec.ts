import { expect, it } from "vitest";
import type { HealthResult } from "../../src";
it("accepts server health metadata", () => {
    const h: HealthResult = { code: 200, message: "ok", data: { cpuCores: 4 } };
    expect(h.data.cpuCores).toBe(4);
});
