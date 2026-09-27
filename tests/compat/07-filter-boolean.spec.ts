import { expect, it } from "vitest";
import { bindFilter } from "../../src";
it("preserves boolean filter values", () =>
    expect(bindFilter("live={:v}", { v: true })).toBe("live=true"));
