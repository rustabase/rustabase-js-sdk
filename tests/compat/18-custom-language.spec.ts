import { expect, it } from "vitest";
import { createClient } from "../../src";
import { mockFetch } from "../helpers";
it("sends platform locale", async () => {
    const m = mockFetch();
    await createClient("http://x", { fetch: m.fetch, lang: "km-KH" }).health();
    expect((m.calls[0].init.headers as any)["Accept-Language"]).toBe("km-KH");
});
