import { expect, it } from "vitest";
import { createClient } from "../../src";
it("avoids invalid empty file URLs", () =>
    expect(createClient("http://x").files.url({ id: "1", collectionId: "c" }, " ")).toBe(
        "",
    ));
