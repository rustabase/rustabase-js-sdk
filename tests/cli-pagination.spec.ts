import { afterEach, expect, test, vi } from "vitest";
// @ts-ignore shipped ESM CLI
import { loadSchema } from "../bin/rustabase.mjs";

afterEach(() => vi.unstubAllGlobals());

test("schema loading includes the final page beyond the former 99-page cap", async () => {
    const fetcher = vi.fn(async (url: string) => {
        const page = Number(new URL(url).searchParams.get("page"));
        return new Response(JSON.stringify({ items: [{ name: `table_${page}` }], totalPages: 100 }));
    });
    vi.stubGlobal("fetch", fetcher);
    const rows = await loadSchema({ url: "https://host.test", token: "test-token" }, {});
    expect(fetcher).toHaveBeenCalledTimes(100);
    expect(rows).toHaveLength(100);
    expect(rows[99]).toEqual({ name: "table_100" });
});
