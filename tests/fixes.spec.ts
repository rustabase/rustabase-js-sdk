import { describe, expect, it } from "vitest";
import { bindFilter, readClaims, RustaBaseError, tokenExpired } from "../src";
import { fakeToken } from "./helpers";

describe("RustaBaseError.from", () => {
    it("keeps url, status and data of wrapped errors", () => {
        const err = RustaBaseError.from({
            message: "boom",
            url: "https://x.test/api",
            status: 503,
            data: { message: "boom" },
        });
        expect(err.url).toBe("https://x.test/api");
        expect(err.status).toBe(503);
        expect(err.data.message).toBe("boom");
    });

    it("marks abort errors as cancelled", () => {
        const err = RustaBaseError.from(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        expect(err.cancelled).toBe(true);
        expect(err.status).toBe(0);
    });
});

describe("tokenExpired", () => {
    it("treats a non-numeric exp as expired", () => {
        expect(tokenExpired(fakeToken({ exp: "soon" as any }))).toBe(true);
    });

    it("accepts a token without exp", () => {
        expect(tokenExpired(fakeToken({ id: "x" }))).toBe(false);
    });
});

describe("bindFilter", () => {
    it("ignores prototype-chain keys", () => {
        expect(bindFilter("a = {:constructor}")).toBe("a = {:constructor}");
        expect(bindFilter("a = {:x}", { x: 1 })).toBe("a = 1");
    });
});

describe("readClaims", () => {
    it("returns {} for garbage", () => {
        expect(readClaims("not-a-jwt")).toEqual({});
    });
});
