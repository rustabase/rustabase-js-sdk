import { expect, it } from "vitest";
import { bindFilter } from "../../src";
it("escapes quoted filter text", () =>
    expect(bindFilter("name={:n}", { n: 'a"b' })).toBe('name="a\\"b"'));
