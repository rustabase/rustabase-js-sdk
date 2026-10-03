import { describe, expect, it } from "vitest";
import { createClient, MemorySession } from "../src";
import { mockFetch } from "./helpers";

const make = (reply?: Parameters<typeof mockFetch>[0]) => {
    const m = mockFetch(reply);
    const rb = createClient("http://x", { session: new MemorySession(), fetch: m.fetch });
    return { rb, ...m };
};

describe("tables", () => {
    it("lists with options", async () => {
        const { rb, calls } = make(() => ({
            body: { items: [], page: 2, perPage: 5, totalItems: 0, totalPages: 0 },
        }));
        await rb.from("posts").list({
            page: 2,
            perPage: 5,
            sort: "-created",
            filter: "a=1",
            expand: "author",
        });
        expect(calls[0].url).toBe(
            "http://x/api/collections/posts/records?page=2&perPage=5&filter=a%3D1&sort=-created&expand=author",
        );
    });

    it("walks every page in all()", async () => {
        let n = 0;
        const { rb } = make(() => {
            n++;
            return {
                body: {
                    items: n === 1 ? [{ id: "1" }, { id: "2" }] : [{ id: "3" }],
                    perPage: 2,
                },
            };
        });
        const rows = await rb.from("posts").all({ chunk: 2 });
        expect(rows.map((r) => r.id)).toEqual(["1", "2", "3"]);
    });

    it("first() throws 404 when empty", async () => {
        const { rb } = make(() => ({ body: { items: [], perPage: 1 } }));
        await expect(rb.from("posts").first("a=1")).rejects.toMatchObject({
            status: 404,
        });
    });

    it("create / update / remove", async () => {
        const { rb, calls } = make((_u, init) => ({
            body: init.method === "DELETE" ? {} : { id: "1" },
        }));
        await rb.from("posts").create({ title: "a" });
        await rb.from("posts").update("1", { title: "b" });
        await rb.from("posts").remove("1");
        expect(calls.map((c) => c.init.method)).toEqual(["POST", "PATCH", "DELETE"]);
        expect(calls[1].url).toBe("http://x/api/collections/posts/records/1");
    });

    it("uploads files as multipart with a json part", async () => {
        const { rb, calls } = make(() => ({ body: { id: "1" } }));
        await rb.from("posts").create({ title: "a", views: 2, cover: new Blob(["x"]) });
        const body = calls[0].init.body as FormData;
        expect(body).toBeInstanceOf(FormData);
        expect(JSON.parse(body.get("@jsonPayload") as string)).toEqual({
            title: "a",
            views: 2,
        });
        expect(body.get("cover")).toBeInstanceOf(Blob);
    });

    it("keeps the session record in sync on update and remove", async () => {
        const { rb } = make((_u, init) => ({
            body:
                init.method === "PATCH"
                    ? {
                          id: "u1",
                          collectionId: "c1",
                          collectionName: "users",
                          name: "New",
                      }
                    : {},
        }));
        rb.session.set("t", {
            id: "u1",
            collectionId: "c1",
            collectionName: "users",
            name: "Old",
        });
        await rb.from("users").update("u1", { name: "New" });
        expect(rb.session.record?.name).toBe("New");
        await rb.from("users").remove("u1");
        expect(rb.session.token).toBe("");
    });
});

describe("auth", () => {
    it("signs in with password and saves the session", async () => {
        const { rb, calls } = make(() => ({
            body: { token: "tok", record: { id: "1" } },
        }));
        await rb.auth("users").signInWithPassword("a@b.c", "pw");
        expect(calls[0].url).toBe("http://x/api/collections/users/auth-with-password");
        expect(JSON.parse(calls[0].init.body)).toEqual({
            identity: "a@b.c",
            password: "pw",
        });
        expect(rb.session.token).toBe("tok");
    });

    it("otp flow", async () => {
        const { rb, calls } = make((u) => ({
            body: u.endsWith("request-otp")
                ? { otpId: "o1" }
                : { token: "t", record: { id: "1" } },
        }));
        const { otpId } = await rb.auth().requestOtp("a@b.c");
        await rb.auth().signInWithOtp(otpId, "123456");
        expect(JSON.parse(calls[1].init.body)).toEqual({
            otpId: "o1",
            password: "123456",
        });
        expect(rb.session.token).toBe("t");
    });
});

describe("files and batch", () => {
    it("builds file urls", () => {
        const { rb } = make();
        expect(
            rb.files.url({ id: "r1", collectionId: "c1" }, "a b.png", {
                thumb: "100x100",
                download: true,
            }),
        ).toBe("http://x/api/files/c1/r1/a%20b.png?thumb=100x100&download=true");
        expect(rb.files.url(null, "x")).toBe("");
    });

    it("sends a batch", async () => {
        const { rb, calls } = make(() => ({ body: [] }));
        const b = rb.batch();
        b.from("posts").create({ title: "a", file: new Blob(["x"]) });
        b.from("posts").remove("9");
        await b.send();
        const form = calls[0].init.body as FormData;
        const payload = JSON.parse(form.get("@jsonPayload") as string);
        expect(payload.requests).toHaveLength(2);
        expect(payload.requests[0]).toMatchObject({
            method: "POST",
            url: "/api/collections/posts/records",
            body: { title: "a" },
        });
        expect(payload.requests[1]).toMatchObject({
            method: "DELETE",
            url: "/api/collections/posts/records/9",
        });
        expect(form.get("requests.0.file")).toBeInstanceOf(Blob);
    });
});

describe("admin", () => {
    it("reaches the admin endpoints", async () => {
        const { rb, calls } = make(() => ({ body: {} }));
        await rb.admin.collections.truncate("posts");
        await rb.admin.apiKeys.rotate("k1");
        await rb.admin.rls.setEnabled("posts", { enabled: true });
        await rb.admin.sql("select 1");
        expect(
            calls.map((c) => c.init.method + " " + c.url.replace("http://x", "")),
        ).toEqual([
            "DELETE /api/collections/posts/truncate",
            "POST /api/api-keys/k1/rotate",
            "POST /api/rls/tables/posts/rls",
            "POST /api/sql",
        ]);
    });
});
