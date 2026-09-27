import { Admin } from "./admin";
import { Batch } from "./data/batch";
import { Files } from "./data/files";
import { AuthTable, Table } from "./data/table";
import { RustaBaseError } from "./errors";
import { prepareBody, isFormData } from "./internal/body";
import { bindFilter, joinUrl, withQuery } from "./internal/encode";
import { tokenExpired } from "./internal/token";
import { Realtime } from "./realtime/realtime";
import { BrowserSession } from "./session/browser";
import { MemorySession, Session } from "./session/session";
import type { HealthResult, Json, RequestOptions, RetryOptions, Row } from "./types";

export interface ClientOptions {
    /** Where the session is kept. Defaults to localStorage in browsers, memory elsewhere. */
    session?: Session;
    /** Sent as `Accept-Language`. Default "en-US". */
    lang?: string;
    /** Custom fetch implementation (e.g. for SSR frameworks). */
    fetch?: typeof fetch;
    /** Cancel older duplicate requests automatically. Default true. */
    autoCancel?: boolean;
    credentials?: RequestCredentials;
    timeout?: number;
    retry?: number | RetryOptions;
}

/** Runs before each request. Return a new url/init to change what is sent. */
export type RequestHook = (
    url: string,
    init: RequestInit & RequestOptions,
) =>
    | void
    | { url?: string; init?: RequestInit & RequestOptions }
    | Promise<void | { url?: string; init?: RequestInit & RequestOptions }>;

/** Runs after each response. Whatever it returns becomes the result data. */
export type ResponseHook = (response: Response, data: any) => any | Promise<any>;

/**
 * The RustaBase client.
 *
 *     const rb = createClient("https://my-app.rustabase.net");
 *     const posts = await rb.from("posts").list({ sort: "-created" });
 */
export class RustaBase {
    /** Server address (absolute, or relative to the current page in browsers). */
    readonly baseUrl: string;
    readonly session: Session;
    lang: string;
    autoCancel: boolean;
    credentials?: RequestCredentials;
    timeout: number;
    retry: number | RetryOptions;
    onRequest?: RequestHook;
    onResponse?: ResponseHook;

    readonly realtime: Realtime;
    readonly files: Files;
    readonly admin: Admin;

    private readonly fetchImpl?: typeof fetch;
    private readonly controllers = new Map<string, AbortController>();
    private readonly tables = new Map<string, Table>();
    private keepAlive?: {
        leeway: number;
        run: () => Promise<unknown>;
        stop: () => void;
    };

    constructor(baseUrl = "/", options: ClientOptions = {}) {
        this.baseUrl = baseUrl;
        this.lang = options.lang || "en-US";
        this.autoCancel = options.autoCancel ?? true;
        this.credentials = options.credentials;
        this.timeout = options.timeout ?? 0;
        this.retry = options.retry ?? 0;
        this.fetchImpl = options.fetch;
        this.session =
            options.session ||
            (typeof window !== "undefined" && (window as any).Deno === undefined
                ? new BrowserSession()
                : new MemorySession());

        this.realtime = new Realtime(this);
        this.files = new Files(this);
        this.admin = new Admin(this);
    }

    /** Works with the records of a collection. */
    from<T extends Row = Row>(collection: string): Table<T> {
        let t = this.tables.get(collection);
        if (!t) {
            t = new Table(this, collection);
            this.tables.set(collection, t);
        }
        return t as Table<T>;
    }

    /** Sign-in, sign-up helpers and records for an auth collection (e.g. "users"). */
    auth<T extends Row = Row>(collection = "users"): AuthTable<T> {
        const key = "auth:" + collection;
        let t = this.tables.get(key);
        if (!t) {
            t = new AuthTable(this, collection);
            this.tables.set(key, t);
        }
        return t as AuthTable<T>;
    }

    /** Signs out locally (clears the saved session and cancels pending requests). */
    signOut(): void {
        this.cancelAll();
        this.session.clear();
    }

    /** Starts a batch of record writes that run together in one transaction. */
    batch(): Batch {
        return new Batch(this);
    }

    /** Checks the server status. */
    health(options?: RequestOptions): Promise<HealthResult> {
        return this.request("/api/health", options);
    }

    /** Safely inserts values into a filter, e.g. `rb.filter("title = {:t}", { t })`. */
    filter(expression: string, params?: Json): string {
        return bindFilter(expression, params);
    }

    /** Full url for a server path. */
    url(path = ""): string {
        let base = this.baseUrl;
        if (
            typeof window !== "undefined" &&
            window.location &&
            !/^https?:\/\//.test(base)
        ) {
            const origin = (window.location.origin || "").replace(/\/$/, "");
            base = base.startsWith("/")
                ? origin + base
                : joinUrl(
                      origin + (window.location.pathname || "/").replace(/[^/]*$/, ""),
                      base,
                  );
        }
        return joinUrl(base, path);
    }

    /** Cancels a pending request by its key. */
    cancel(requestKey: string): void {
        this.controllers.get(requestKey)?.abort();
        this.controllers.delete(requestKey);
    }

    /** Cancels every pending request. */
    cancelAll(): void {
        for (const c of this.controllers.values()) c.abort();
        this.controllers.clear();
    }

    /**
     * Low-level request helper used by every method. Throws `RustaBaseError`
     * for network failures, cancellations and responses with status >= 400.
     */
    async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
        const {
            query,
            headers,
            body,
            requestKey,
            fetch: fetchOverride,
            timeout,
            retry,
            ...rest
        } = options;
        const method = (options.method || "GET").toUpperCase();
        const skipKeepAlive = (rest as any).__noKeepAlive;
        delete (rest as any).__noKeepAlive;

        if (this.keepAlive && !skipKeepAlive && this.session.token) {
            if (tokenExpired(this.session.token, this.keepAlive.leeway)) {
                try {
                    await this.keepAlive.run();
                } catch {
                    // the request below will surface any auth problem
                }
            }
        }

        const finalHeaders: Record<string, string> = { ...(headers || {}) };
        const prepared = prepareBody(body);
        const has = (name: string) =>
            Object.keys(finalHeaders).some((k) => k.toLowerCase() === name.toLowerCase());

        if (!has("Content-Type") && !isFormData(prepared) && prepared !== undefined) {
            finalHeaders["Content-Type"] = "application/json";
        }
        if (!has("Accept-Language")) finalHeaders["Accept-Language"] = this.lang;
        if (!has("Authorization") && this.session.token) {
            finalHeaders["Authorization"] = this.session.token;
        }

        let init: RequestInit & RequestOptions = {
            ...rest,
            method,
            headers: finalHeaders,
            body:
                prepared !== undefined &&
                typeof prepared === "object" &&
                !isFormData(prepared) &&
                !(typeof Blob !== "undefined" && prepared instanceof Blob)
                    ? JSON.stringify(prepared)
                    : prepared,
            credentials: rest.credentials ?? this.credentials,
        };

        let key: string | null = null;
        if (this.autoCancel && requestKey !== null && !options.signal) {
            key = requestKey || method + " " + withQuery(path, query);
            this.cancel(key);
            const controller = new AbortController();
            this.controllers.set(key, controller);
            init.signal = controller.signal;
        }

        let url = withQuery(this.url(path), query);

        if (this.onRequest) {
            const changed = await this.onRequest(url, init);
            if (changed) {
                url = changed.url ?? url;
                init = changed.init ?? init;
            }
        }

        const doFetch = fetchOverride || this.fetchImpl || fetch;
        const policy = normalizeRetry(retry ?? this.retry);
        const maxAttempts = canRetryMethod(method, policy.unsafe)
            ? policy.attempts + 1
            : 1;
        const timeoutMs = timeout ?? this.timeout;
        try {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const attemptController = new AbortController();
                const signal = combineSignals(
                    [init.signal, attemptController.signal].filter(
                        Boolean,
                    ) as AbortSignal[],
                );
                const timer =
                    timeoutMs > 0
                        ? setTimeout(() => attemptController.abort(), timeoutMs)
                        : undefined;
                try {
                    const response = await doFetch(url, { ...init, signal });
                    const text = response.status === 204 ? "" : await response.text();
                    let data: any = {};
                    if (text) {
                        try {
                            data = JSON.parse(text);
                            if (data === null || data === undefined) data = {};
                        } catch (cause) {
                            throw new RustaBaseError({
                                url: response.url || url,
                                status: response.status,
                                message: response.ok
                                    ? "The server returned an invalid JSON response."
                                    : response.statusText,
                                data: response.ok ? { response: text } : {},
                                cause,
                            });
                        }
                    }
                    if (this.onResponse) data = await this.onResponse(response, data);
                    if (response.status >= 400) {
                        if (
                            !data ||
                            typeof data !== "object" ||
                            !Object.keys(data).length
                        ) {
                            data = {
                                code: response.status,
                                message: response.statusText || "Request failed.",
                                data: {},
                            };
                        }
                        const retryAfter = parseRetryAfter(
                            response.headers.get("retry-after"),
                        );
                        const error = new RustaBaseError({
                            url: response.url || url,
                            status: response.status,
                            data,
                            retryAfter,
                        });
                        if (
                            attempt + 1 < maxAttempts &&
                            policy.statuses.includes(response.status)
                        ) {
                            await wait(
                                retryAfter ?? backoff(policy.delay, attempt),
                                init.signal,
                            );
                            continue;
                        }
                        throw error;
                    }
                    return data as T;
                } catch (err) {
                    const wrapped = RustaBaseError.from(err, url);
                    if (
                        attempt + 1 < maxAttempts &&
                        wrapped.status === 0 &&
                        !wrapped.cancelled
                    ) {
                        await wait(backoff(policy.delay, attempt), init.signal);
                        continue;
                    }
                    throw wrapped;
                } finally {
                    if (timer) clearTimeout(timer);
                }
            }
            throw new RustaBaseError({ url });
        } catch (err) {
            throw RustaBaseError.from(err, url);
        } finally {
            if (key && this.controllers.get(key)?.signal === init.signal) {
                this.controllers.delete(key);
            }
        }
    }

    /** @internal Keeps the current session fresh before requests. */
    _setKeepAlive(leeway: number | undefined, run: () => Promise<unknown>): void {
        this.keepAlive?.stop();
        this.keepAlive = undefined;
        if (!leeway) return;

        const owner = this.session.record;
        const off = this.session.onChange((token, record) => {
            if (
                !token ||
                record?.id !== owner?.id ||
                record?.collectionId !== owner?.collectionId
            ) {
                this._setKeepAlive(undefined, run);
            }
        });
        this.keepAlive = { leeway, run, stop: off };
    }
}

function normalizeRetry(value: number | RetryOptions): Required<RetryOptions> {
    const input = typeof value === "number" ? { attempts: value } : value;
    return {
        attempts: Math.max(0, Math.floor(input.attempts ?? 0)),
        delay: Math.max(0, input.delay ?? 250),
        statuses: input.statuses ?? [408, 429, 500, 502, 503, 504],
        unsafe: input.unsafe ?? false,
    };
}

function canRetryMethod(method: string, unsafe: boolean): boolean {
    return unsafe || ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"].includes(method);
}

function backoff(delay: number, attempt: number): number {
    return Math.round(delay * 2 ** attempt * (0.8 + Math.random() * 0.4));
}

function parseRetryAfter(value: string | null): number | null {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
    if (signals.length === 1) return signals[0];
    const controller = new AbortController();
    for (const signal of signals) {
        if (signal.aborted) controller.abort(signal.reason);
        else
            signal.addEventListener("abort", () => controller.abort(signal.reason), {
                once: true,
            });
    }
    return controller.signal;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(signal.reason);
            },
            { once: true },
        );
    });
}

/** Creates a RustaBase client. */
export function createClient(baseUrl = "/", options?: ClientOptions): RustaBase {
    return new RustaBase(baseUrl, options);
}
