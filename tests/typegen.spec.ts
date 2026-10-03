import { describe, expect, test } from "vitest";
// @ts-ignore plain ESM helper shipped with the CLI
import { generateTypes, pascal } from "../bin/typegen.mjs";
// @ts-ignore
import { parseArgs } from "../bin/rustabase.mjs";

const schema = [
    {
        name: "blog_posts",
        type: "base",
        fields: [
            { name: "id", type: "text", system: true, required: true },
            { name: "title", type: "text", required: true },
            { name: "views", type: "number" },
            { name: "published", type: "bool" },
            { name: "status", type: "select", values: ["draft", "live"], maxSelect: 1 },
            { name: "tags", type: "select", options: { values: ["a", "b"], maxSelect: 3 } },
            { name: "author", type: "relation", maxSelect: 1 },
            { name: "images", type: "file", maxSelect: 5 },
            { name: "meta", type: "json" },
            { name: "where", type: "geoPoint" },
            { name: "created", type: "autodate" },
            { name: "secret note", type: "text", hidden: true },
        ],
    },
    {
        name: "users",
        type: "auth",
        fields: [
            { name: "email", type: "email", required: true },
            { name: "password", type: "password", required: true },
        ],
    },
    { name: "stats", type: "view", fields: [{ name: "total", type: "number" }] },
    { name: "_superusers", type: "auth", system: true, fields: [] },
];

describe("gen-types", () => {
    const out = generateTypes(schema);

    test("maps every field type", () => {
        expect(out).toContain("export interface BlogPosts {");
        expect(out).toContain("    title: string;");
        expect(out).toContain("    views: number;");
        expect(out).toContain("    published: boolean;");
        expect(out).toContain('    status: "draft" | "live";');
        expect(out).toContain('    tags: Array<"a" | "b">;');
        expect(out).toContain("    author: string;");
        expect(out).toContain("    images: string[];");
        expect(out).toContain("    meta: unknown;");
        expect(out).toContain("    where: { lon: number; lat: number };");
    });

    test("keeps secrets out of rows and computed fields out of create data", () => {
        const row = out.split("export interface Users {")[1].split("}")[0];
        expect(row).not.toContain("password");
        expect(out.split("export interface BlogPosts {")[1].split("}")[0]).not.toContain("secret note");
        const create = out.split("export interface BlogPostsCreate {")[1].split("}")[0];
        expect(create).toContain("    title: string;");
        expect(create).toContain("    views?: number;");
        expect(create).not.toContain("created");
        expect(create).not.toContain(" id");
        expect(out.split("export interface UsersCreate {")[1]).toContain("    password: string;");
    });

    test("views are read-only and system tables are skipped", () => {
        expect(out).toContain("export type StatsCreate = never;");
        expect(out).not.toContain("Superusers");
        expect(generateTypes(schema, { includeSystem: true })).toContain("interface Superusers");
    });

    test("table map", () => {
        expect(out).toContain("    blog_posts: BlogPosts;");
        expect(out).toContain("export type TableName = keyof Tables;");
    });

    test("names and args", () => {
        expect(pascal("blog_posts")).toBe("BlogPosts");
        expect(pascal("2fa-codes")).toBe("T2faCodes");
        expect(parseArgs(["gen-types", "--url=http://x", "--out", "a.ts"])).toMatchObject({
            _: ["gen-types"],
            url: "http://x",
            out: "a.ts",
        });
    });
});
