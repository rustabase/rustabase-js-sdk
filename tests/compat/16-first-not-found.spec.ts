import { expect, it } from "vitest";
import { createClient } from "../../src";
import { mockFetch } from "../helpers";
it("maps an empty first query to 404", async () => {
    const rb = createClient("http://x", {
        fetch: mockFetch(() => ({ body: { items: [], perPage: 1 } })).fetch,
    });
    await expect(rb.from("p").first("id='x'")).rejects.toMatchObject({ status: 404 });
});
