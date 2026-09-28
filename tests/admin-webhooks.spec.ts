import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { fetch: m.fetch, session: new MemorySession() });
    return { rb, ...m };
};

describe("admin.webhooks", () => {
    it("lists deliveries with status and limit", async () => {
        const { rb, calls } = make(() => ({ body: [{ id: "d1", status: "error" }] }));
        const rows = await rb.admin.webhooks.deliveries("wh1", { status: "error", limit: 20 });
        expect(rows).toHaveLength(1);
        expect(calls[0].init.method).toBe("GET");
        expect(calls[0].url).toBe("http://x/api/webhooks/wh1/deliveries?status=error&limit=20");
    });

    it("clamps the delivery limit to 1-500", async () => {
        const { rb, calls } = make(() => ({ body: [] }));
        await rb.admin.webhooks.deliveries("a", { limit: 2000 });
        await rb.admin.webhooks.deliveries("a", { limit: 0 });
        expect(calls[0].url).toContain("limit=500");
        expect(calls[1].url).toContain("limit=1");
    });

    it("clears deliveries", async () => {
        const { rb, calls } = make();
        await expect(rb.admin.webhooks.clearDeliveries("wh 1")).resolves.toBe(true);
        expect(calls[0].init.method).toBe("DELETE");
        expect(calls[0].url).toBe("http://x/api/webhooks/wh%201/deliveries");
    });
});
