import { describe, expect, it } from "vitest";
import { tokenExpiresIn } from "../src";

const jwt = (claims: object) =>
    "h." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".s";

describe("tokenExpiresIn()", () => {
    it("returns seconds left", () => {
        const left = tokenExpiresIn(jwt({ exp: Math.floor(Date.now() / 1000) + 120 }))!;
        expect(left).toBeGreaterThanOrEqual(119);
        expect(left).toBeLessThanOrEqual(120);
    });
    it("is negative once expired", () => {
        expect(tokenExpiresIn(jwt({ exp: 1 }))!).toBeLessThan(0);
    });
    it("is null without exp and 0 for malformed tokens", () => {
        expect(tokenExpiresIn(jwt({ sub: "u" }))).toBeNull();
        expect(tokenExpiresIn("garbage")).toBe(0);
        expect(tokenExpiresIn(jwt({ exp: "soon" }))).toBe(0);
    });
});
