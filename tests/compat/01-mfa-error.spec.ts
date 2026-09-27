import { expect, it } from "vitest";
import { RustaBaseError } from "../../src";
it("reads MFA challenge ids", () =>
    expect(new RustaBaseError({ data: { mfaId: "m1" } }).mfaId).toBe("m1"));
