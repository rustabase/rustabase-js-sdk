import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { fetch: m.fetch, session: new MemorySession() });
    return { rb, ...m };
};

describe("admin.logs filters", () => {
    it("forwards activity filters on list", async () => {
        const { rb, calls } = make(() => ({ body: { items: [] } }));
        await rb.admin.logs.list({ clientOnly: true, minLevel: 4, search: "boom", perPage: 5 });
        const url = new URL(calls[0].url);
        expect(url.pathname).toBe("/api/logs");
        expect(url.searchParams.get("clientOnly")).toBe("true");
        expect(url.searchParams.get("minLevel")).toBe("4");
        expect(url.searchParams.get("search")).toBe("boom");
        expect(url.searchParams.get("perPage")).toBe("5");
    });

    it("omits unset filters on stats", async () => {
        const { rb, calls } = make(() => ({ body: [] }));
        await rb.admin.logs.stats({ filter: "level>0", since: "2026-01-01 00:00:00" });
        const url = new URL(calls[0].url);
        expect(url.searchParams.get("filter")).toBe("level>0");
        expect(url.searchParams.get("since")).toBe("2026-01-01 00:00:00");
        expect(url.searchParams.has("clientOnly")).toBe(false);
    });
});
