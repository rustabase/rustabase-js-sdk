import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { fetch: m.fetch, session: new MemorySession() });
    return { rb, ...m };
};

describe("admin.settings", () => {
    it("sends S3 overrides with the filesystem", async () => {
        const { rb, calls } = make();
        await rb.admin.settings.testStorage("backups", { overrides: { bucket: "b", forcePathStyle: true } });
        expect(calls[0].url).toBe("http://x/api/settings/test/s3");
        expect(JSON.parse(calls[0].init.body)).toEqual({ bucket: "b", forcePathStyle: true, filesystem: "backups" });
    });

    it("keeps the plain filesystem body by default", async () => {
        const { rb, calls } = make();
        await rb.admin.settings.testStorage();
        expect(JSON.parse(calls[0].init.body)).toEqual({ filesystem: "storage" });
    });

    it("sends test email fields", async () => {
        const { rb, calls } = make();
        await rb.admin.settings.testEmail("users", "a@b.c", "otp");
        expect(JSON.parse(calls[0].init.body)).toEqual({ email: "a@b.c", template: "otp", collection: "users" });
    });
});
