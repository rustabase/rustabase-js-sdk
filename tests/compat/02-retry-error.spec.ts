import { expect, it } from "vitest";
import { RustaBaseError } from "../../src";
it("serializes retry delay", () =>
    expect(new RustaBaseError({ retryAfter: 500 }).toJSON().retryAfter).toBe(500));
