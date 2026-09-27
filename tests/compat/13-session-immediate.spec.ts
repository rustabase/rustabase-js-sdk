import { expect, it } from "vitest";
import { MemorySession } from "../../src";
it("can emit current session immediately", () => {
    const s = new MemorySession();
    let n = 0;
    s.onChange(() => n++, true);
    expect(n).toBe(1);
});
