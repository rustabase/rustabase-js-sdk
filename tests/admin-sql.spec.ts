import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { fetch: m.fetch, session: new MemorySession() });
    return { rb, ...m };
};

describe("admin.sql", () => {
    it("returns exec time and affected rows", async () => {
        const { rb, calls } = make(() => ({
            body: { execTime: 1.5, affectedRows: 2, columns: [], rows: [] },
        }));
        const out = await rb.admin.sql("update posts set a = 1");
        expect(JSON.parse(calls[0].init.body)).toEqual({ query: "update posts set a = 1" });
        expect(out.affectedRows).toBe(2);
        expect(out.execTime).toBe(1.5);
    });
});
