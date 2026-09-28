import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { fetch: m.fetch, session: new MemorySession() });
    return { rb, ...m };
};

describe("admin.rls.test", () => {
    it("sends the Go server test body and returns counts", async () => {
        const { rb, calls } = make(() => ({
            body: { table: "posts", role: "authenticated", userId: "u1", totalRows: 3, visibleRows: 1, blockedRows: 2, sampleRows: [], sampleLimit: 5, rolledBackOk: true },
        }));
        const out = await rb.admin.rls.test({ table: "posts", userId: "u1", role: "authenticated", limit: 5 });
        expect(calls[0].url).toBe("http://x/api/rls/test");
        expect(JSON.parse(calls[0].init.body)).toEqual({ table: "posts", userId: "u1", role: "authenticated", limit: 5 });
        expect(out.blockedRows).toBe(2);
        expect(out.rolledBackOk).toBe(true);
    });
});
