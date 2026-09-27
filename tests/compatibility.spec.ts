import { describe, expect, it, vi } from "vitest";
import { createClient, MemorySession, RustaBaseError } from "../src";
import { mockFetch } from "./helpers";

describe("Go server compatibility", () => {
    it("surfaces an MFA challenge id", async () => {
        const fetchImpl = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({ message: "MFA required", mfaId: "mfa_1" }),
                    {
                        status: 401,
                        headers: { "content-type": "application/json" },
                    },
                ),
        );
        const rb = createClient("http://x", { fetch: fetchImpl as typeof fetch });
        const error = await rb
            .auth()
            .signInWithPassword("a@b.c", "pw")
            .catch((e) => e);
        expect(error).toBeInstanceOf(RustaBaseError);
        expect(error.mfaId).toBe("mfa_1");
    });

    it("sends MFA ids in password, OTP, and OAuth bodies", async () => {
        const { fetch, calls } = mockFetch(() => ({
            body: { token: "t", record: { id: "u" } },
        }));
        const rb = createClient("http://x", { fetch, session: new MemorySession() });
        await rb.auth().signInWithPassword("a@b.c", "pw", { mfaId: "m1" });
        await rb.auth().signInWithOtp("otp1", "123456", { mfaId: "m2" });
        await rb
            .auth()
            .signInWithOAuthCode(
                "github",
                "code",
                "verifier",
                "http://redirect",
                {},
                { mfaId: "m3" },
            );
        expect(calls.map((call) => JSON.parse(call.init.body).mfaId)).toEqual([
            "m1",
            "m2",
            "m3",
        ]);
        expect(calls[2].url).not.toContain("mfaId");
    });

    it("retries transient reads but not writes", async () => {
        let reads = 0;
        const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
            if (init.method === "GET") reads++;
            const status = init.method === "GET" && reads < 3 ? 503 : 200;
            return new Response(JSON.stringify({ ok: status === 200 }), { status });
        });
        const rb = createClient("http://x", {
            fetch: fetchImpl as typeof fetch,
            retry: { attempts: 2, delay: 0 },
        });
        await expect(rb.request("/read")).resolves.toEqual({ ok: true });
        await expect(rb.request("/write", { method: "POST", body: {} })).resolves.toEqual(
            { ok: true },
        );
        expect(reads).toBe(3);
        expect(fetchImpl).toHaveBeenCalledTimes(4);
    });

    it("reports invalid successful JSON", async () => {
        const fetchImpl = vi.fn(async () => new Response("not-json", { status: 200 }));
        const rb = createClient("http://x", { fetch: fetchImpl as typeof fetch });
        await expect(rb.health()).rejects.toMatchObject({
            status: 200,
            message: "The server returned an invalid JSON response.",
        });
    });

    it("records Retry-After on errors", async () => {
        const fetchImpl = vi.fn(
            async () =>
                new Response(JSON.stringify({ message: "Slow down" }), {
                    status: 429,
                    headers: { "retry-after": "2" },
                }),
        );
        const rb = createClient("http://x", { fetch: fetchImpl as typeof fetch });
        await expect(rb.health()).rejects.toMatchObject({
            status: 429,
            retryAfter: 2000,
        });
    });

    it("clears a batch after a successful send", async () => {
        const rb = createClient("http://x", {
            fetch: mockFetch(() => ({ body: [] })).fetch,
        });
        const batch = rb.batch();
        batch.from("posts").create({ title: "One" });
        await batch.send();
        expect(batch.size).toBe(0);
        await expect(batch.send()).rejects.toThrow("empty");
    });
});
