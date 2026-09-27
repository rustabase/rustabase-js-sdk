import { expect, it } from "vitest";
import { MemorySession } from "../../src";
it("clears token and record together", () => {
    const s = new MemorySession();
    s.set("t", { id: "u", collectionId: "c", collectionName: "users" });
    s.clear();
    expect([s.token, s.record]).toEqual(["", null]);
});
