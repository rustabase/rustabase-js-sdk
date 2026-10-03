import { describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client";
import { RustaBaseError } from "../src/errors";
import { isFormData } from "../src/internal/body";
import { readClaims, tokenExpired } from "../src/internal/token";
import { MemorySession } from "../src/session/session";
import { fakeToken, mockFetch } from "./helpers";

describe("crud guards", () => {
    it("rejects all() with a chunk below 1", async () => {
        const rb = createClient("http://example.test", { fetch: mockFetch().fetch });
        await expect(rb.from("posts").all({ chunk: 0 })).rejects.toThrow("chunk");
    });

    it("rejects update() and remove() without an id", async () => {
        const rb = createClient("http://example.test", { fetch: mockFetch().fetch });
        await expect(rb.from("posts").update("")).rejects.toMatchObject({ status: 404 });
        await expect(rb.from("posts").remove("")).rejects.toMatchObject({ status: 404 });
    });

    it("rejects sending an empty batch", async () => {
        const rb = createClient("http://example.test", { fetch: mockFetch().fetch });
        await expect(rb.batch().send()).rejects.toThrow("empty");
    });
});

describe("error responses", () => {
    it("keeps the status text when the error body is not JSON", async () => {
        const fetchImpl = vi.fn(
            async () =>
                new Response("<html>Bad Gateway</html>", {
                    status: 502,
                    statusText: "Bad Gateway",
                }),
        );
        const rb = createClient("http://example.test", { fetch: fetchImpl as any });
        const err = await rb.health().catch((e) => e);
        expect(err).toBeInstanceOf(RustaBaseError);
        expect(err.status).toBe(502);
        expect(err.message).toBe("Bad Gateway");
    });

    it("treats a null JSON body as an empty object", async () => {
        const fetchImpl = vi.fn(async () => new Response("null", { status: 200 }));
        const rb = createClient("http://example.test", { fetch: fetchImpl as any });
        expect(await rb.health()).toEqual({});
    });
});

describe("session", () => {
    it("does not notify listeners when nothing changed", () => {
        const s = new MemorySession();
        const token = fakeToken({ id: "u1" });
        const record = { id: "u1" };
        s.set(token, record);
        let calls = 0;
        s.onChange(() => calls++);
        s.set(token, record);
        expect(calls).toBe(0);
        s.set(token, { id: "u1" });
        expect(calls).toBe(1);
    });

    it("ignores a non-numeric exp in the cookie expiry", () => {
        const s = new MemorySession();
        s.set(fakeToken({ exp: "soon" as any }), { id: "u1" });
        expect(s.toCookie()).toContain("Expires=Thu, 01 Jan 1970");
    });
});

describe("body detection", () => {
    it("does not crash on null-prototype objects", () => {
        const weird = Object.create(null);
        expect(isFormData(weird)).toBe(false);
    });
});

describe("token", () => {
    it("reads claims with 1-char base64 remainders", () => {
        // payload length chosen so the base64url body ends with a single char
        const claims = readClaims(fakeToken({ id: "abcd", collectionId: "x" }));
        expect(claims.id).toBe("abcd");
    });

    it("tokenExpired stays false for tokens without exp", () => {
        expect(tokenExpired(fakeToken({ id: "x" }))).toBe(false);
    });
});

describe("realtime", () => {
    it("rolls back the listener when the first connect fails", async () => {
        const rb = createClient("http://example.test", { fetch: mockFetch().fetch });
        const rt = rb.realtime;
        rt.maxRetries = 0;
        const orig = (globalThis as any).EventSource;
        (globalThis as any).EventSource = class {
            onerror: (() => void) | null = null;
            constructor() {
                setTimeout(() => this.onerror?.(), 0);
            }
            addEventListener() {}
            removeEventListener() {}
            close() {}
        };
        try {
            await expect(rt.subscribe("posts/*", () => {})).rejects.toBeInstanceOf(
                RustaBaseError,
            );
            expect((rt as any).topics.size).toBe(0);
        } finally {
            (globalThis as any).EventSource = orig;
        }
    });
});
