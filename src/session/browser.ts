import { SESSION_KEY } from "../protocol";
import type { Row } from "../types";
import { Session } from "./session";

/**
 * Session saved in `localStorage`, kept in sync across browser tabs.
 * Falls back to memory when storage isn't available.
 */
export class BrowserSession extends Session {
    private readonly key: string;
    private readonly storage: Storage | null;

    constructor(key = SESSION_KEY) {
        super();
        this.key = key;
        this.storage = BrowserSession.detectStorage();
        this.restore();

        if (typeof window !== "undefined" && window.addEventListener) {
            window.addEventListener("storage", (e) => {
                if (e.key === this.key) this.restore(true);
            });
        }
    }

    set(token: string, record?: Row | null): void {
        this.write({ token, record: record ?? null });
        super.set(token, record);
    }

    clear(): void {
        try {
            this.storage?.removeItem(this.key);
        } catch {}
        super.clear();
    }

    private restore(notify = false): void {
        let saved: any = null;
        try {
            const raw = this.storage?.getItem(this.key);
            saved = raw ? JSON.parse(raw) : null;
        } catch {}
        this._token = saved?.token || "";
        this._record = saved?.record || null;
        if (notify) this.emit();
    }

    private write(value: unknown): void {
        try {
            this.storage?.setItem(this.key, JSON.stringify(value));
        } catch {}
    }

    private static detectStorage(): Storage | null {
        try {
            if (typeof window === "undefined" || !window.localStorage) return null;
            const probe = "__rb_probe__";
            window.localStorage.setItem(probe, "1");
            window.localStorage.removeItem(probe);
            return window.localStorage;
        } catch {
            return null;
        }
    }
}
