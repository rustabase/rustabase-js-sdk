import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { fetch: m.fetch, session: new MemorySession() });
    return { rb, ...m };
};

describe("admin.functions.invoke", () => {
    it("posts to the public edge hook with the secret header", async () => {
        const { rb, calls } = make(() => ({ body: { ok: true } }));
        const out = await rb.admin.functions.invoke("hello", { body: { a: 1 }, secret: "s3" });
        expect(out).toEqual({ ok: true });
        expect(calls[0].url).toBe("http://x/edge-hook/hello");
        expect(calls[0].init.method).toBe("POST");
        expect(calls[0].init.body).toBe('{"a":1}');
        expect(calls[0].init.headers["X-Edge-Secret"]).toBe("s3");
    });

    it("supports GET with query values", async () => {
        const { rb, calls } = make();
        await rb.admin.functions.invoke("report", { method: "GET", query: { day: "mon" } });
        expect(calls[0].init.method).toBe("GET");
        expect(calls[0].url).toBe("http://x/edge-hook/report?day=mon");
        expect(calls[0].init.headers["X-Edge-Secret"]).toBeUndefined();
    });
});

describe("admin.functions.logs", () => {
    it("clamps the log limit", async () => {
        const { rb, calls } = make(() => ({ body: [] }));
        await rb.admin.functions.logs("f1", { status: "error", limit: 999 });
        expect(calls[0].url).toBe("http://x/api/functions/f1/logs?status=error&limit=500");
    });
});
