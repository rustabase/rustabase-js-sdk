import type { RustaBase } from "../client";
import { seg, withQuery } from "../internal/encode";
import type { FileUrlOptions, RequestOptions } from "../types";

/** File helpers: `rb.files`. */
export class Files {
    private readonly rb: RustaBase;

    constructor(rb: RustaBase) {
        this.rb = rb;
    }

    /**
     * Public url of a file stored on a record. Returns "" when the
     * record or file name is missing.
     *
     *     rb.files.url(post, post.cover, { thumb: "300x200" })
     */
    url(
        record: { id?: string; collectionId?: string; collectionName?: string } | null | undefined,
        filename: string,
        options: FileUrlOptions = {},
    ): string {
        const collection = record?.collectionId || record?.collectionName;
        if (!filename || !record?.id || !collection) return "";
        const { download, ...rest } = options;
        const query: Record<string, any> = { ...rest };
        if (download) query.download = true;
        return withQuery(
            this.rb.url(`/api/files/${seg(collection)}/${seg(record.id)}/${seg(filename)}`),
            query,
        );
    }

    /** Short-lived token for protected files (pass it as `{ token }` to `url()`). */
    async token(options: RequestOptions = {}): Promise<string> {
        const res = await this.rb.request<{ token?: string }>("/api/files/token", {
            ...options,
            method: "POST",
        });
        return res?.token || "";
    }
}
