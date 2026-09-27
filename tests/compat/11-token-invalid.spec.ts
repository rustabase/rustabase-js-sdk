import { expect, it } from "vitest";
import { readClaims } from "../../src";
it("rejects malformed session tokens safely", () =>
    expect(readClaims("bad")).toEqual({}));
