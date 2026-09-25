import { vi } from "vitest";

export interface Call {
    url: string;
    init: RequestInit & Record<string, any>;
}

/** A fetch mock that records calls and replies with `reply(url, init)`. */
export function mockFetch(reply: (url: string, init: any) => { status?: number; body?: any } = () => ({ body: {} })) {
    const calls: Call[] = [];
    const fn = vi.fn(async (url: string, init: any) => {
        calls.push({ url, init });
        await new Promise((r) => setTimeout(r, 0));
        if (init?.signal?.aborted) {
            const e = new Error("Aborted");
            e.name = "AbortError";
            throw e;
        }
        const r = reply(url, init);
        return {
            url,
            status: r.status ?? 200,
            json: async () => r.body ?? {},
        } as any;
    });
    return { fetch: fn as unknown as typeof fetch, calls };
}

/** Builds an unsigned JWT with the given claims. */
export function fakeToken(claims: Record<string, any>): string {
    const enc = (o: any) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.sig`;
}
