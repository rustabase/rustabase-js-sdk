import { describe, expect, it } from "vitest";
import { createClient, MemorySession, RustaBaseError } from "../src";
import { fakeToken, mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("https://api.example.com/", { session: new MemorySession(), fetch: m.fetch });
    return { rb, ...m };
};

describe("client", () => {
    it("builds urls", () => {
        const { rb } = make();
        expect(rb.url("/api/health")).toBe("https://api.example.com/api/health");
        expect(rb.url("api/x")).toBe("https://api.example.com/api/x");
    });

    it("sends json with language and auth headers", async () => {
        const { rb, calls } = make(() => ({ body: { ok: true } }));
        rb.session.set("tok", null);
        const out = await rb.request("/api/x", { method: "POST", body: { a: 1 }, query: { q: "a b", n: [1, 2] } });
        expect(out).toEqual({ ok: true });
        expect(calls[0].url).toBe("https://api.example.com/api/x?q=a%20b&n=1&n=2");
        expect(calls[0].init.body).toBe('{"a":1}');
        expect(calls[0].init.headers).toMatchObject({
            "Content-Type": "application/json",
            "Accept-Language": "en-US",
            Authorization: "tok",
        });
    });

    it("throws RustaBaseError on 4xx", async () => {
        const { rb } = make(() => ({ status: 400, body: { message: "Bad", data: { title: { code: "x", message: "y" } } } }));
        const err = await rb.request("/api/x").catch((e) => e);
        expect(err).toBeInstanceOf(RustaBaseError);
        expect(err.status).toBe(400);
        expect(err.message).toBe("Bad");
        expect(err.fieldErrors.title.code).toBe("x");
    });

    it("auto-cancels duplicate requests", async () => {
        const { rb } = make();
        const a = rb.request("/api/x");
        const b = rb.request("/api/x");
        const [ra, rbb] = await Promise.allSettled([a, b]);
        expect(ra.status).toBe("rejected");
        expect((ra as any).reason.cancelled).toBe(true);
        expect(rbb.status).toBe("fulfilled");
    });

    it("does not cancel with requestKey null", async () => {
        const { rb } = make();
        const res = await Promise.allSettled([
            rb.request("/api/x", { requestKey: null }),
            rb.request("/api/x", { requestKey: null }),
        ]);
        expect(res.every((r) => r.status === "fulfilled")).toBe(true);
    });

    it("runs request and response hooks", async () => {
        const { rb, calls } = make(() => ({ body: { v: 1 } }));
        rb.onRequest = (url, init) => ({ url: url + "?hooked=1", init });
        rb.onResponse = (_res, data) => ({ ...data, extra: true });
        expect(await rb.request("/api/x")).toEqual({ v: 1, extra: true });
        expect(calls[0].url).toContain("hooked=1");
    });

    it("binds filter values safely", () => {
        const { rb } = make();
        expect(rb.filter("a = {:a} && b = {:b} && c = {:c} && d = {:d}", { a: 'x"y', b: 2, c: null, d: [1] })).toBe(
            'a = "x\\"y" && b = 2 && c = null && d = "[1]"',
        );
    });

    it("session knows superusers", () => {
        const { rb } = make();
        rb.session.set(fakeToken({ type: "auth", collectionId: "rbc_3142635823", exp: 9999999999 }));
        expect(rb.session.isSuperuser).toBe(true);
        expect(rb.session.isValid).toBe(true);
        rb.session.set(fakeToken({ type: "auth", exp: 1 }), { id: "1", collectionId: "c", collectionName: "users" });
        expect(rb.session.isSuperuser).toBe(false);
        expect(rb.session.isUser).toBe(true);
        expect(rb.session.isValid).toBe(false);
    });

    it("round-trips the session through a cookie", () => {
        const a = new MemorySession();
        a.set(fakeToken({ exp: 9999999999 }), { id: "1", collectionId: "c", collectionName: "users" });
        const header = a.toCookie().split(";")[0];
        const b = new MemorySession();
        b.loadCookie(header);
        expect(b.token).toBe(a.token);
        expect(b.record?.id).toBe("1");
    });
});
