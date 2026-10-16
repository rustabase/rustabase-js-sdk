import { describe, expect, it } from "vitest";
import { RustaBaseError } from "../src";

describe("fieldErrors", () => {
    it("returns field errors keyed by name", () => {
        const e = new RustaBaseError({
            status: 400,
            data: { data: { title: { code: "required", message: "Missing" } } },
        });
        expect(e.fieldErrors.title.code).toBe("required");
    });
    it("ignores non-object payloads", () => {
        expect(
            new RustaBaseError({ status: 400, data: { data: "oops" } }).fieldErrors,
        ).toEqual({});
        expect(
            new RustaBaseError({ status: 400, data: { data: [1, 2] } }).fieldErrors,
        ).toEqual({});
    });
});
