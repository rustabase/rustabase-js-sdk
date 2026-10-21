import { expect, test } from "vitest";
// @ts-ignore shipped ESM CLI
import { parseArgs } from "../bin/rustabase.mjs";

test("inline option values preserve all equals signs", () => {
    expect(parseArgs(["gen-types", "--token=example==", "--url=https://host.test/?x=a=b"]))
        .toMatchObject({ token: "example==", url: "https://host.test/?x=a=b" });
});

test("missing option values fail before consuming the next option", () => {
    expect(() => parseArgs(["gen-types", "--url"])).toThrow("missing value for --url");
    expect(() => parseArgs(["gen-types", "--url", "--out", "types.ts"])).toThrow("missing value for --url");
    expect(() => parseArgs(["gen-types", "--token="])).toThrow("missing value for --token");
    expect(parseArgs(["gen-types", "--out", "-"])).toMatchObject({ out: "-" });
});
