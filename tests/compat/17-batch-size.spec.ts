import { expect, it } from "vitest";
import { createClient } from "../../src";
it("tracks queued batch writes", () => {
    const b = createClient("http://x").batch();
    b.from("p").create({ x: 1 });
    b.from("p").remove("1");
    expect(b.size).toBe(2);
});
