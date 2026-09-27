/**
 * Error thrown for every failed RustaBase request.
 *
 * `status` is 0 when the request never reached the server
 * (network failure, CORS, cancellation).
 */
export class RustaBaseError extends Error {
    readonly url: string;
    readonly status: number;
    /** Parsed JSON body returned by the server (empty object when none). */
    readonly data: Record<string, any>;
    /** True when the request was cancelled (manually or by auto-cancel). */
    readonly cancelled: boolean;
    /** Original thrown value, if the error wrapped something else. */
    readonly cause?: unknown;
    readonly mfaId: string;
    readonly retryAfter: number | null;

    constructor(init: {
        message?: string;
        url?: string;
        status?: number;
        data?: Record<string, any>;
        cancelled?: boolean;
        cause?: unknown;
        retryAfter?: number | null;
    }) {
        const data = init.data && typeof init.data === "object" ? init.data : {};
        const message =
            init.message ||
            (typeof data.message === "string" && data.message) ||
            (init.cancelled
                ? "The request was cancelled."
                : init.status
                  ? `Request failed with status ${init.status}.`
                  : "Could not reach the RustaBase server.");

        super(message);
        this.name = "RustaBaseError";
        this.url = init.url || "";
        this.status = init.status || 0;
        this.data = data;
        this.cancelled = !!init.cancelled;
        this.cause = init.cause;
        this.mfaId = typeof data.mfaId === "string" ? data.mfaId : "";
        this.retryAfter = init.retryAfter ?? null;
        Object.setPrototypeOf(this, RustaBaseError.prototype);
    }

    /** Field validation errors returned by the server, keyed by field name. */
    get fieldErrors(): Record<string, { code: string; message: string }> {
        return (this.data?.data as any) || {};
    }

    /** Wraps any thrown value into a RustaBaseError (returned as-is if it already is one). */
    static from(err: unknown, url = ""): RustaBaseError {
        if (err instanceof RustaBaseError) {
            return err;
        }
        const e = err as any;
        const cancelled =
            e?.name === "AbortError" || e?.message === "Aborted" || e?.cancelled === true;
        return new RustaBaseError({
            url: url || e?.url || "",
            status: typeof e?.status === "number" ? e.status : 0,
            data: e?.data && typeof e.data === "object" ? e.data : undefined,
            cancelled,
            message: cancelled ? undefined : e?.message,
            cause: err,
            retryAfter: typeof e?.retryAfter === "number" ? e.retryAfter : null,
        });
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            url: this.url,
            status: this.status,
            data: this.data,
            cancelled: this.cancelled,
            mfaId: this.mfaId,
            retryAfter: this.retryAfter,
        };
    }
}
