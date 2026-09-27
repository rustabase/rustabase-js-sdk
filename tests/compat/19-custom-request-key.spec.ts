import { expect, it } from "vitest";
import { createClient } from "../../src";
import { mockFetch } from "../helpers";
it("accepts explicit cancellation groups", async () => {
    const m = mockFetch();
    const rb = createClient("http://x", { fetch: m.fetch });
    const a = rb.health({ requestKey: "health" });
    const b = rb.health({ requestKey: "health" });
    const r = await Promise.allSettled([a, b]);
    expect(r[0].status).toBe("rejected");
});
