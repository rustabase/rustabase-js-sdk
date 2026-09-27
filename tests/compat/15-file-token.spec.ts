import { expect, it } from "vitest";
import { createClient } from "../../src";
import { mockFetch } from "../helpers";
it("reads protected file tokens", async () => {
    const rb = createClient("http://x", {
        fetch: mockFetch(() => ({ body: { token: "f1" } })).fetch,
    });
    expect(await rb.files.token()).toBe("f1");
});
