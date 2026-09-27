import { expect, it } from "vitest";
import { bindFilter } from "../../src";
it("binds null filter values", () =>
    expect(bindFilter("deleted={:v}", { v: null })).toBe("deleted=null"));
