import { describe, expect, it } from "vitest";
import { createClient } from "../src";
import { mockFetch } from "./helpers";

describe("count()", () => {
    it("asks for one row with the total and returns totalItems", async () => {
        const { fetch, calls } = mockFetch(() => ({
            body: { page: 1, perPage: 1, totalItems: 42, totalPages: 42, items: [] },
        }));
        const rb = createClient("http://x", { fetch });
        await expect(rb.from("posts").count('status = "live"')).resolves.toBe(42);
        const url = new URL(calls[0].url);
        expect(url.searchParams.get("perPage")).toBe("1");
        expect(url.searchParams.get("skipTotal")).toBe("false");
        expect(url.searchParams.get("filter")).toBe('status = "live"');
        expect(url.searchParams.get("fields")).toBe("id");
    });
    it("returns 0 when the server omits the total", async () => {
        const rb = createClient("http://x", {
            fetch: mockFetch(() => ({ body: { items: [] } })).fetch,
        });
        await expect(rb.from("posts").count()).resolves.toBe(0);
    });
});
