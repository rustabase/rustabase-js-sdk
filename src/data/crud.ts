import type { RustaBase } from "../client";
import { RustaBaseError } from "../errors";
import { seg } from "../internal/encode";
import type {
    AllOptions,
    Body,
    ListOptions,
    Page,
    ReadOptions,
    RequestOptions,
} from "../types";

/** Moves read options (filter, sort, expand...) into the query string. */
export function readQuery(
    options: ReadOptions & Partial<ListOptions> = {},
): RequestOptions {
    const { expand, fields, page, perPage, filter, sort, skipTotal, query, ...rest } =
        options;
    return {
        ...rest,
        query: {
            page,
            perPage,
            filter,
            sort,
            skipTotal,
            expand,
            fields,
            ...(query || {}),
        },
    };
}

/** Paged list / read / write helpers for one REST resource. */
export class Crud<T> {
    protected readonly rb: RustaBase;
    protected readonly path: string;

    constructor(rb: RustaBase, path: string) {
        this.rb = rb;
        this.path = path;
    }

    /** One page of rows. */
    list(options: ListOptions = {}): Promise<Page<T>> {
        return this.rb.request(this.path, {
            ...readQuery({ page: 1, perPage: 30, ...options }),
            method: "GET",
        });
    }

    /** Every row, walking through all pages. */
    async all(options: AllOptions = {}): Promise<T[]> {
        const { chunk = 1000, ...rest } = options;
        if (!Number.isInteger(chunk) || chunk < 1) {
            throw new Error("all() needs a chunk of at least 1.");
        }
        const out: T[] = [];
        for (let page = 1; ; page++) {
            const res = await this.list({
                ...rest,
                page,
                perPage: chunk,
                skipTotal: true,
                requestKey: rest.requestKey ?? null,
            });
            out.push(...res.items);
            if (res.items.length < res.perPage) return out;
        }
    }

    /** The first row matching a filter. Throws a 404 error when nothing matches. */
    async first(filter: string, options: Omit<ListOptions, "filter"> = {}): Promise<T> {
        const res = await this.list({
            requestKey: "first " + this.path + " " + filter,
            ...options,
            filter,
            page: 1,
            perPage: 1,
            skipTotal: true,
        });
        if (!res.items.length) {
            throw new RustaBaseError({
                status: 404,
                url: this.rb.url(this.path),
                data: { code: 404, message: "No row matches the filter.", data: {} },
            });
        }
        return res.items[0];
    }

    /** One row by id. */
    get(id: string, options: ReadOptions = {}): Promise<T> {
        if (!id) {
            return Promise.reject(
                new RustaBaseError({
                    status: 404,
                    url: this.rb.url(this.path + "/"),
                    data: { code: 404, message: "An id is required.", data: {} },
                }),
            );
        }
        return this.rb.request(this.path + "/" + seg(id), {
            ...readQuery(options),
            method: "GET",
        });
    }

    /** Creates a row. Objects containing files are uploaded as multipart. */
    create(data: Body = {}, options: ReadOptions = {}): Promise<T> {
        return this.rb.request(this.path, {
            ...readQuery(options),
            method: "POST",
            body: data,
        });
    }

    /** Updates a row. */
    update(id: string, data: Body = {}, options: ReadOptions = {}): Promise<T> {
        if (!id) return missingId(this.rb, this.path);
        return this.rb.request(this.path + "/" + seg(id), {
            ...readQuery(options),
            method: "PATCH",
            body: data,
        });
    }

    /** Deletes a row. */
    async remove(id: string, options: RequestOptions = {}): Promise<true> {
        if (!id) await missingId(this.rb, this.path);
        else
            await this.rb.request(this.path + "/" + seg(id), {
                ...options,
                method: "DELETE",
            });
        return true;
    }
}

function missingId(rb: RustaBase, path: string): Promise<never> {
    return Promise.reject(
        new RustaBaseError({
            status: 404,
            url: rb.url(path + "/"),
            data: { code: 404, message: "An id is required.", data: {} },
        }),
    );
}
