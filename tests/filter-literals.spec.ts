import { describe, expect, it } from "vitest";
import { bindFilter } from "../src/internal/encode";

describe("bindFilter literals", () => {
    it("binds non-finite numbers as null", () => {
        expect(bindFilter("a = {:x}", { x: NaN })).toBe("a = null");
        expect(bindFilter("a = {:x}", { x: Infinity })).toBe("a = null");
        expect(bindFilter("a = {:x}", { x: -Infinity })).toBe("a = null");
    });

    it("binds an invalid Date as null instead of throwing", () => {
        expect(() => bindFilter("d > {:d}", { d: new Date("nope") })).not.toThrow();
        expect(bindFilter("d > {:d}", { d: new Date("nope") })).toBe("d > null");
    });

    it("keeps finite numbers and valid dates unchanged", () => {
        expect(bindFilter("a = {:x}", { x: 1.5 })).toBe("a = 1.5");
        expect(bindFilter("d > {:d}", { d: new Date("2026-01-02T03:04:05.000Z") })).toBe(
            'd > "2026-01-02 03:04:05.000Z"',
        );
    });
});
