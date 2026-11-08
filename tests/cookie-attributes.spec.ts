import { describe, expect, it } from "vitest";
import { writeCookie } from "../src/internal/cookie";
import { MemorySession } from "../src/session/session";
import { fakeToken } from "./helpers";

describe("cookie attributes", () => {
    it("refuses a path or domain that would add extra attributes", () => {
        expect(() => writeCookie("rb", "v", { path: "/; Domain=evil.example" })).toThrow(
            "path",
        );
        expect(() =>
            writeCookie("rb", "v", { domain: "example.com\r\nSet-Cookie: x=1" }),
        ).toThrow("domain");
        expect(() => writeCookie("rb", "v", { domain: "a .example.com" })).toThrow(
            "domain",
        );
    });

    it("refuses an unknown sameSite value", () => {
        expect(() =>
            writeCookie("rb", "v", { sameSite: "Lax; Domain=evil.example" as any }),
        ).toThrow("sameSite");
    });

    it("refuses an invalid expiry or max age instead of writing a broken header", () => {
        expect(() => writeCookie("rb", "v", { expires: new Date("nope") })).toThrow(
            "expires",
        );
        expect(() => writeCookie("rb", "v", { maxAge: NaN })).toThrow("maxAge");
        expect(() => writeCookie("rb", "v", { maxAge: Infinity })).toThrow("maxAge");
    });

    it("keeps normal cookies unchanged", () => {
        expect(
            writeCookie("rb", "v", {
                path: "/app",
                domain: ".example.com",
                maxAge: 60,
                sameSite: "lax",
                secure: true,
            }),
        ).toBe("rb=v; Max-Age=60; Domain=.example.com; Path=/app; Secure; SameSite=Lax");
        const s = new MemorySession();
        s.set(fakeToken({ id: "u1", type: "auth", exp: 2000000000 }), { id: "u1" });
        expect(s.toCookie()).toContain("; Path=/; Expires=");
        expect(s.toCookie()).toContain("HttpOnly; Secure; SameSite=Strict");
    });
});
