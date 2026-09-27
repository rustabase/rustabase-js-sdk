import { expect, it } from "vitest";
import { toQueryString } from "../../src";
it("encodes dates for Go queries", () =>
    expect(toQueryString({ at: new Date("2026-01-02T03:04:05Z") })).toContain(
        "2026-01-02%2003%3A04%3A05.000Z",
    ));
