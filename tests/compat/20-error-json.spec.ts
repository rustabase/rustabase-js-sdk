import { expect, it } from "vitest";
import { RustaBaseError } from "../../src";
it("serializes MFA metadata for logs", () =>
    expect(new RustaBaseError({ data: { mfaId: "m" } }).toJSON()).toMatchObject({
        name: "RustaBaseError",
        mfaId: "m",
    }));
