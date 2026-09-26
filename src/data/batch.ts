import type { RustaBase } from "../client";
import { splitBody } from "../internal/body";
import { seg, withQuery } from "../internal/encode";
import type { BatchResult, Body, ReadOptions, RequestOptions } from "../types";
import { readQuery } from "./crud";

interface Step {
    method: string;
    url: string;
    headers?: Record<string, string>;
    json: Record<string, any>;
    files: Record<string, any[]>;
}

/**
 * Several record writes sent in one request and applied in one transaction.
 *
 *     const batch = rb.batch();
 *     batch.from("posts").create({ title: "A" });
 *     batch.from("posts").remove("abc");
 *     const results = await batch.send();
 */
export class Batch {
    private readonly rb: RustaBase;
    private readonly steps: Step[] = [];

    constructor(rb: RustaBase) {
        this.rb = rb;
    }

    /** Queue writes for one collection. */
    from(collection: string) {
        const path = "/api/collections/" + seg(collection) + "/records";
        const add = (method: string, url: string, body?: Body, options: ReadOptions = {}) => {
            const { query, headers } = readQuery(options);
            const { json, files } = splitBody(body);
            this.steps.push({ method, url: withQuery(url, query), headers, json, files });
        };
        return {
            create: (data: Body, options?: ReadOptions) => add("POST", path, data, options),
            update: (id: string, data: Body, options?: ReadOptions) =>
                add("PATCH", path + "/" + seg(id), data, options),
            /** Updates when `data.id` exists, otherwise creates. */
            upsert: (data: Body, options?: ReadOptions) => add("PUT", path, data, options),
            remove: (id: string, options?: ReadOptions) =>
                add("DELETE", path + "/" + seg(id), undefined, options),
        };
    }

    /** Number of queued writes. */
    get size(): number {
        return this.steps.length;
    }

    /** Sends every queued write. */
    send(options: RequestOptions = {}): Promise<BatchResult[]> {
        if (!this.steps.length) {
            return Promise.reject(new Error("The batch is empty — queue at least one write."));
        }
        const form = new FormData();
        const requests = this.steps.map((s, i) => {
            for (const [field, list] of Object.entries(s.files)) {
                for (const file of list) form.append(`requests.${i}.${field}`, file);
            }
            return { method: s.method, url: s.url, headers: s.headers, body: s.json };
        });
        form.append("@jsonPayload", JSON.stringify({ requests }));
        return this.rb.request("/api/batch", { ...options, method: "POST", body: form });
    }
}
