import type { RustaBase } from "../client";
import { Crud, readQuery } from "../data/crud";
import { seg } from "../internal/encode";
import type { Body, Json, ListOptions, Page, RequestOptions } from "../types";

/** Simple REST resource without paging (api keys, webhooks, functions). */
class Resource<T> {
    constructor(
        protected readonly rb: RustaBase,
        protected readonly path: string,
    ) {}

    list(options: RequestOptions = {}): Promise<T[]> {
        return this.rb.request(this.path, { ...options, method: "GET" });
    }
    get(id: string, options: RequestOptions = {}): Promise<T> {
        return this.rb.request(this.path + "/" + seg(id), { ...options, method: "GET" });
    }
    create(data: Json, options: RequestOptions = {}): Promise<T> {
        return this.rb.request(this.path, { ...options, method: "POST", body: data });
    }
    update(id: string, data: Json, options: RequestOptions = {}): Promise<T> {
        return this.rb.request(this.path + "/" + seg(id), { ...options, method: "PATCH", body: data });
    }
    async remove(id: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request(this.path + "/" + seg(id), { ...options, method: "DELETE" });
        return true;
    }
    protected action<R = any>(id: string, name: string, method: string, options: RequestOptions, body?: any): Promise<R> {
        return this.rb.request(`${this.path}/${seg(id)}/${name}`, { ...options, method, body });
    }
}

export interface Collection extends Json {
    id: string;
    name: string;
    type: "base" | "auth" | "view" | string;
    fields: Json[];
    system: boolean;
}

export class Collections extends Crud<Collection> {
    constructor(rb: RustaBase) {
        super(rb, "/api/collections");
    }
    /** Replaces the schema with the given collections. */
    async import(collections: Json[], deleteMissing = false, options: RequestOptions = {}): Promise<true> {
        await this.rb.request(this.path + "/import", {
            ...options,
            method: "PUT",
            body: { collections, deleteMissing },
        });
        return true;
    }
    /** Deletes every record of a collection. */
    async truncate(collection: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request(`${this.path}/${seg(collection)}/truncate`, { ...options, method: "DELETE" });
        return true;
    }
    /** Default field sets for each collection type. */
    scaffolds(options: RequestOptions = {}): Promise<Record<string, Collection>> {
        return this.rb.request(this.path + "/meta/scaffolds", { ...options, method: "GET" });
    }
    oauthProviders(options: RequestOptions = {}): Promise<Json[]> {
        return this.rb.request(this.path + "/meta/oauth2-providers", { ...options, method: "GET" });
    }
    /** Runs a view query and returns sample rows. */
    previewView(query: string, options: RequestOptions = {}): Promise<Json> {
        return this.rb.request(this.path + "/meta/dry-run-view", { ...options, method: "POST", body: { query } });
    }
}

export class Settings {
    constructor(private readonly rb: RustaBase) {}
    get(options: RequestOptions = {}): Promise<Json> {
        return this.rb.request("/api/settings", { ...options, method: "GET" });
    }
    update(data: Body, options: RequestOptions = {}): Promise<Json> {
        return this.rb.request("/api/settings", { ...options, method: "PATCH", body: data });
    }
    async testStorage(filesystem: "storage" | "backups" = "storage", options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/settings/test/s3", { ...options, method: "POST", body: { filesystem } });
        return true;
    }
    async testEmail(collection: string, to: string, template: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/settings/test/email", {
            ...options,
            method: "POST",
            body: { email: to, template, collection },
        });
        return true;
    }
    appleClientSecret(
        input: { clientId: string; teamId: string; keyId: string; privateKey: string; duration: number },
        options: RequestOptions = {},
    ): Promise<{ secret: string }> {
        return this.rb.request("/api/settings/apple/generate-client-secret", { ...options, method: "POST", body: input });
    }
}

export class Logs {
    constructor(private readonly rb: RustaBase) {}
    list(options: ListOptions = {}): Promise<Page<Json>> {
        return this.rb.request("/api/logs", { ...readQuery({ page: 1, perPage: 30, ...options }), method: "GET" });
    }
    get(id: string, options: RequestOptions = {}): Promise<Json> {
        return this.rb.request("/api/logs/" + seg(id), { ...options, method: "GET" });
    }
    stats(options: RequestOptions & { filter?: string } = {}): Promise<Array<{ total: number; date: string }>> {
        const { filter, ...rest } = options;
        return this.rb.request("/api/logs/stats", { ...rest, method: "GET", query: { filter, ...(rest.query || {}) } });
    }
    async clear(options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/logs", { ...options, method: "DELETE" });
        return true;
    }
}

export interface Backup {
    key: string;
    size: number;
    modified: string;
}

export class Backups {
    constructor(private readonly rb: RustaBase) {}
    list(options: RequestOptions = {}): Promise<Backup[]> {
        return this.rb.request("/api/backups", { ...options, method: "GET" });
    }
    async create(name = "", options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/backups", { ...options, method: "POST", body: { name } });
        return true;
    }
    /** Uploads a backup archive: `upload({ file: blob })`. */
    async upload(data: Body, options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/backups/upload", { ...options, method: "POST", body: data });
        return true;
    }
    async remove(key: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/backups/" + seg(key), { ...options, method: "DELETE" });
        return true;
    }
    async restore(key: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request(`/api/backups/${seg(key)}/restore`, { ...options, method: "POST" });
        return true;
    }
    /** Download link; get the token with `rb.files.token()`. */
    downloadUrl(key: string, token: string): string {
        return this.rb.url(`/api/backups/${seg(key)}?token=${seg(token)}`);
    }
}

export class Crons {
    constructor(private readonly rb: RustaBase) {}
    list(options: RequestOptions = {}): Promise<Array<{ id: string; expression: string }>> {
        return this.rb.request("/api/crons", { ...options, method: "GET" });
    }
    async run(jobId: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request("/api/crons/" + seg(jobId), { ...options, method: "POST" });
        return true;
    }
}

export class ApiKeys extends Resource<Json> {
    constructor(rb: RustaBase) {
        super(rb, "/api/api-keys");
    }
    /** Issues a new secret for the key. The secret is only shown once. */
    rotate(id: string, options: RequestOptions = {}): Promise<Json> {
        return this.action(id, "rotate", "POST", options);
    }
}

export class Webhooks extends Resource<Json> {
    constructor(rb: RustaBase) {
        super(rb, "/api/webhooks");
    }
    stats(options: RequestOptions = {}): Promise<Json> {
        return this.rb.request(this.path + "/stats", { ...options, method: "GET" });
    }
    test(id: string, payload: Json = {}, options: RequestOptions = {}): Promise<Json> {
        return this.action(id, "test", "POST", options, payload);
    }
    /** Latest delivery attempts of a webhook, newest first. */
    deliveries(
        id: string,
        filter: { status?: "success" | "error"; limit?: number } = {},
        options: RequestOptions = {},
    ): Promise<Json[]> {
        return this.action(id, "deliveries", "GET", { ...options, query: { ...filter, ...(options.query || {}) } });
    }
    /** Deletes the stored delivery history of a webhook. */
    async clearDeliveries(id: string, options: RequestOptions = {}): Promise<true> {
        await this.action(id, "deliveries", "DELETE", options);
        return true;
    }
}

export class Functions extends Resource<Json> {
    constructor(rb: RustaBase) {
        super(rb, "/api/functions");
    }
    stats(options: RequestOptions = {}): Promise<Json> {
        return this.rb.request(this.path + "/stats", { ...options, method: "GET" });
    }
    duplicate(id: string, options: RequestOptions = {}): Promise<Json> {
        return this.action(id, "duplicate", "POST", options);
    }
    /** Runs a function with a test payload. */
    test(id: string, payload: Json = {}, options: RequestOptions = {}): Promise<Json> {
        return this.action(id, "test", "POST", options, payload);
    }
    logs(id: string, filter: { status?: string; limit?: number } = {}, options: RequestOptions = {}): Promise<Json[]> {
        return this.action(id, "logs", "GET", { ...options, query: { ...filter, ...(options.query || {}) } });
    }
    async clearLogs(id: string, options: RequestOptions = {}): Promise<true> {
        await this.action(id, "logs", "DELETE", options);
        return true;
    }
}

/** Row level security rules for database tables. */
export class Rls {
    constructor(private readonly rb: RustaBase) {}
    private p = (table: string, rest = "") => `/api/rls/tables/${seg(table)}${rest}`;

    templates(options: RequestOptions = {}): Promise<Json[]> {
        return this.rb.request("/api/rls/templates", { ...options, method: "GET" });
    }
    tables(options: RequestOptions = {}): Promise<Json[]> {
        return this.rb.request("/api/rls/tables", { ...options, method: "GET" });
    }
    policies(table: string, options: RequestOptions = {}): Promise<Json[]> {
        return this.rb.request(this.p(table, "/policies"), { ...options, method: "GET" });
    }
    createPolicy(table: string, data: Json, options: RequestOptions = {}): Promise<Json> {
        return this.rb.request(this.p(table, "/policies"), { ...options, method: "POST", body: data });
    }
    updatePolicy(table: string, name: string, data: Json, options: RequestOptions = {}): Promise<Json> {
        return this.rb.request(this.p(table, "/policies/" + seg(name)), { ...options, method: "PATCH", body: data });
    }
    async removePolicy(table: string, name: string, options: RequestOptions = {}): Promise<true> {
        await this.rb.request(this.p(table, "/policies/" + seg(name)), { ...options, method: "DELETE" });
        return true;
    }
    /** Turns RLS on or off for a table. */
    async setEnabled(table: string, settings: { enabled: boolean; force?: boolean }, options: RequestOptions = {}): Promise<true> {
        await this.rb.request(this.p(table, "/rls"), { ...options, method: "POST", body: settings });
        return true;
    }
    preview(data: Json, options: RequestOptions = {}): Promise<{ sql: string; error: string }> {
        return this.rb.request("/api/rls/preview", { ...options, method: "POST", body: data });
    }
    test(data: Json, options: RequestOptions = {}): Promise<Json> {
        return this.rb.request("/api/rls/test", { ...options, method: "POST", body: data });
    }
}

/** Superuser-only tools: `rb.admin`. */
export class Admin {
    readonly collections: Collections;
    readonly settings: Settings;
    readonly logs: Logs;
    readonly backups: Backups;
    readonly crons: Crons;
    readonly apiKeys: ApiKeys;
    readonly webhooks: Webhooks;
    readonly functions: Functions;
    readonly rls: Rls;

    constructor(private readonly rb: RustaBase) {
        this.collections = new Collections(rb);
        this.settings = new Settings(rb);
        this.logs = new Logs(rb);
        this.backups = new Backups(rb);
        this.crons = new Crons(rb);
        this.apiKeys = new ApiKeys(rb);
        this.webhooks = new Webhooks(rb);
        this.functions = new Functions(rb);
        this.rls = new Rls(rb);
    }

    /** Runs raw SQL. */
    sql(query: string, options: RequestOptions = {}): Promise<{ columns: string[]; rows: any[]; [k: string]: any }> {
        return this.rb.request("/api/sql", { ...options, method: "POST", body: { query } });
    }
}
