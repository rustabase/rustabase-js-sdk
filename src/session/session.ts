import { readCookie, writeCookie, type CookieOptions } from "../internal/cookie";
import { readClaims, tokenExpired } from "../internal/token";
import { SESSION_KEY, SUPERUSERS, SUPERUSERS_ID } from "../protocol";
import type { Row } from "../types";

export type SessionListener = (token: string, record: Row | null) => void;

/**
 * Holds the signed-in token and record. Extend it to persist the session
 * anywhere (see `MemorySession`, `BrowserSession`, `AsyncSession`).
 */
export class Session {
    protected _token = "";
    protected _record: Row | null = null;
    private listeners = new Set<SessionListener>();

    get token(): string {
        return this._token;
    }

    get record(): Row | null {
        return this._record;
    }

    /** True when a token is present and not expired. */
    get isValid(): boolean {
        return !tokenExpired(this._token);
    }

    /** True when the session belongs to a superuser. */
    get isSuperuser(): boolean {
        const claims = readClaims(this._token);
        if (claims.type !== "auth") return false;
        if (this._record?.collectionName)
            return this._record.collectionName === SUPERUSERS;
        return claims.collectionId === SUPERUSERS_ID;
    }

    /** True when the session belongs to a regular (non-superuser) auth record. */
    get isUser(): boolean {
        return readClaims(this._token).type === "auth" && !this.isSuperuser;
    }

    /** Stores a new token and record and notifies listeners when anything changed. */
    set(token: string, record?: Row | null): void {
        const next = token || "";
        const nextRecord = record ?? null;
        if (next === this._token && nextRecord === this._record) return;
        this._token = next;
        this._record = nextRecord;
        this.emit();
    }

    /** Signs out locally and notifies listeners. */
    clear(): void {
        this._token = "";
        this._record = null;
        this.emit();
    }

    /**
     * Listens for session changes. Returns a function that stops listening.
     * Pass `immediate` to also receive the current state right away.
     */
    onChange(listener: SessionListener, immediate = false): () => void {
        this.listeners.add(listener);
        if (immediate) listener(this._token, this._record);
        return () => {
            this.listeners.delete(listener);
        };
    }

    protected emit(): void {
        for (const l of [...this.listeners]) l(this._token, this._record);
    }

    /** Restores the session from a `Cookie` header (e.g. on a server). */
    loadCookie(cookieHeader: string, name = SESSION_KEY): void {
        const raw = readCookie(cookieHeader || "", name);
        let parsed: any = {};
        try {
            parsed = raw ? JSON.parse(raw) : {};
        } catch {}
        this.set(parsed?.token || "", parsed?.record || null);
    }

    /**
     * Serialises the session into a `Set-Cookie` header value.
     * The cookie expires together with the token. If the result is larger
     * than 4 KB, only the record's core fields are kept.
     */
    toCookie(options: CookieOptions = {}): string {
        const { name = SESSION_KEY, ...rest } = options;
        const opts: CookieOptions = {
            secure: true,
            sameSite: true,
            httpOnly: true,
            path: "/",
            ...rest,
        };
        if (!opts.expires) {
            const exp = readClaims(this._token).exp;
            const ms = typeof exp === "number" && isFinite(exp) ? exp * 1000 : 0;
            opts.expires = new Date(ms);
        }

        const full = writeCookie(
            name,
            JSON.stringify({ token: this._token, record: this._record }),
            opts,
        );
        if (full.length <= 4096 || !this._record) return full;

        const r = this._record;
        const slim = {
            id: r.id,
            email: r.email,
            collectionId: r.collectionId,
            collectionName: r.collectionName,
            verified: r.verified,
        };
        return writeCookie(
            name,
            JSON.stringify({ token: this._token, record: slim }),
            opts,
        );
    }
}

/** Session kept only in memory (lost on reload). Default on servers. */
export class MemorySession extends Session {}
