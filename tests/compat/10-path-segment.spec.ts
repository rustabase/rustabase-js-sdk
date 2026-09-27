import { expect, it } from "vitest";
import { seg } from "../../src";
it("protects collection path segments", () => expect(seg("a/b c")).toBe("a%2Fb%20c"));
