import { expect, it } from "vitest";
import { toQueryString } from "../../src";
it("repeats array query values", () =>
    expect(toQueryString({ id: ["a", "b"] })).toBe("id=a&id=b"));
