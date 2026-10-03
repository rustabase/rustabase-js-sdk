import type { Json } from "../types";

/** Joins a base url and a path with exactly one slash between them. */
export function joinUrl(base: string, path: string): string {
    if (!path) return base;
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

/** Appends a query string to a url. */
export function withQuery(url: string, query?: Json): string {
    const qs = toQueryString(query);
    if (!qs) return url;
    return url + (url.includes("?") ? "&" : "?") + qs;
}

/** Encodes a value map as a query string. Arrays repeat the key; objects become JSON. */
export function toQueryString(query?: Json): string {
    if (!query) return "";
    const out: string[] = [];
    for (const [key, raw] of Object.entries(query)) {
        if (raw === undefined || raw === null) continue;
        const values = Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
            out.push(encodeURIComponent(key) + "=" + encodeURIComponent(stringifyParam(value)));
        }
    }
    return out.join("&");
}

function stringifyParam(value: unknown): string {
    if (value instanceof Date) return value.toISOString().replace("T", " ");
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value);
}

/** Encodes a path segment. */
export const seg = (value: string) => encodeURIComponent(value);

/**
 * Safely binds `{:name}` placeholders in a filter expression.
 *
 *     rb.filter("title ~ {:q} && created > {:since}", { q: "hi", since: new Date() })
 */
export function bindFilter(expression: string, params?: Json): string {
    if (!params) return expression;
    return expression.replace(/\{:([\w]+)\}/g, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name)
            ? filterLiteral(params[name])
            : match,
    );
}

function filterLiteral(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "string") return JSON.stringify(value);
    if (value instanceof Date) return JSON.stringify(value.toISOString().replace("T", " "));
    const json = JSON.stringify(value);
    // arrays/objects are compared as JSON text
    return /^[[{]/.test(json) ? JSON.stringify(json) : json;
}
