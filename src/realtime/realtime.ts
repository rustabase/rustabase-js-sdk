import type { RustaBase } from "../client";
import { RustaBaseError } from "../errors";
import { RB_CONNECT } from "../protocol";
import type { RequestOptions, Unsubscribe } from "../types";

type Listener = (e: Event) => void;

const RETRY_DELAYS_MS = [200, 300, 500, 1000, 1200, 1500, 2000];
const CONNECT_TIMEOUT_MS = 15000;

/**
 * Live connection to the server (Server-Sent Events).
 * Most apps use `rb.from("posts").subscribe(...)` instead of this directly.
 */
export class Realtime {
    /** Id the server gave this connection (empty while disconnected). */
    clientId = "";
    /** Called when the connection drops, with the topics that were active. */
    onDisconnect?: (activeTopics: string[]) => void;
    /** Max reconnect attempts before giving up. */
    maxRetries = Infinity;

    private readonly rb: RustaBase;
    private source: EventSource | null = null;
    private topics = new Map<string, Listener[]>();
    private sentTopics: string[] = [];
    private waiting: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
    private retries = 0;
    private retryTimer?: ReturnType<typeof setTimeout>;
    private connectTimer?: ReturnType<typeof setTimeout>;

    constructor(rb: RustaBase) {
        this.rb = rb;
    }

    get isConnected(): boolean {
        return !!this.source && !!this.clientId && !this.waiting.length;
    }

    /** Subscribes to a raw topic, e.g. "posts/*" or "posts/RECORD_ID". */
    async subscribe(
        topic: string,
        callback: (data: any) => void,
        options?: RequestOptions,
    ): Promise<Unsubscribe> {
        if (!topic) throw new Error("A topic is required.");

        let key = topic;
        if (options && (options.query || options.headers)) {
            const packed = JSON.stringify({ query: clean(options.query), headers: options.headers });
            key += (key.includes("?") ? "&" : "?") + "options=" + encodeURIComponent(packed);
        }

        const listener: Listener = (e) => {
            let data: any = {};
            try {
                data = JSON.parse((e as MessageEvent).data) ?? {};
            } catch {}
            callback(data);
        };

        const list = this.topics.get(key) || [];
        list.push(listener);
        this.topics.set(key, list);

        try {
            if (!this.source) {
                await this.connect();
            } else {
                this.source.addEventListener(key, listener);
                if (list.length === 1) await this.sync();
            }
        } catch (err) {
            // roll back the listener so a failed subscribe() leaves no state behind
            await this.removeListener(key, listener);
            throw err;
        }

        return () => this.removeListener(key, listener);
    }

    /** Removes every listener of a topic, or all topics when omitted. */
    async unsubscribe(topic?: string): Promise<void> {
        let changed = false;
        for (const key of [...this.topics.keys()]) {
            if (topic && baseTopic(key) !== topic) continue;
            this.detach(key);
            changed = true;
        }
        if (changed || !topic) await this.sync();
    }

    /** Removes every topic that starts with `prefix`. */
    async unsubscribeByPrefix(prefix: string): Promise<void> {
        let changed = false;
        for (const key of [...this.topics.keys()]) {
            const base = baseTopic(key);
            if (base === prefix || base.startsWith(prefix + "/")) {
                this.detach(key);
                changed = true;
            }
        }
        if (changed) await this.sync();
    }

    /** Closes the connection and forgets every subscription. */
    disconnect(): void {
        for (const key of [...this.topics.keys()]) this.detach(key);
        this.close(true);
    }

    private async removeListener(key: string, listener: Listener): Promise<void> {
        const list = this.topics.get(key);
        if (!list) return;
        const next = list.filter((l) => l !== listener);
        this.source?.removeEventListener(key, listener);
        if (next.length) {
            this.topics.set(key, next);
            return;
        }
        this.topics.delete(key);
        await this.sync();
    }

    private detach(key: string): void {
        for (const l of this.topics.get(key) || []) this.source?.removeEventListener(key, l);
        this.topics.delete(key);
    }

    private activeTopics(): string[] {
        return [...this.topics.keys()].filter((k) => this.topics.get(k)?.length);
    }

    private async sync(): Promise<void> {
        if (!this.activeTopics().length) {
            this.close();
            return;
        }
        if (!this.clientId) return; // will be sent once connected

        const topics = this.activeTopics();
        if (sameSet(topics, this.sentTopics)) return;
        this.sentTopics = topics;

        try {
            await this.rb.request("/api/realtime", {
                method: "POST",
                body: { clientId: this.clientId, subscriptions: topics },
                requestKey: "realtime:" + this.clientId,
            });
        } catch (err) {
            if ((err as RustaBaseError)?.cancelled) return;
            throw err;
        }
    }

    private connect(): Promise<void> {
        if (this.retries > 0) return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));

        return new Promise<void>((resolve, reject) => {
            this.waiting.push({ resolve, reject });
            if (this.waiting.length > 1) return; // already connecting
            this.open();
        });
    }

    private open(): void {
        this.close(false);
        clearTimeout(this.connectTimer);
        this.connectTimer = setTimeout(
            () => this.handleError(new Error("The live connection timed out.")),
            CONNECT_TIMEOUT_MS,
        );

        const source = new EventSource(this.rb.url("/api/realtime"));
        this.source = source;
        source.onerror = () => this.handleError(new Error("The live connection failed."));

        source.addEventListener(RB_CONNECT, async (e) => {
            this.clientId = (e as MessageEvent).lastEventId;
            this.sentTopics = [];
            for (const [key, list] of this.topics) {
                for (const l of list) source.addEventListener(key, l);
            }
            try {
                await this.sync();
                clearTimeout(this.connectTimer);
                clearTimeout(this.retryTimer);
                this.retries = 0;
                const pending = this.waiting;
                this.waiting = [];
                pending.forEach((p) => p.resolve());
                // topics added while the first sync was in flight
                await this.sync();
            } catch (err) {
                this.clientId = "";
                this.sentTopics = [];
                this.handleError(err);
            }
        });
    }

    private handleError(err: unknown): void {
        clearTimeout(this.connectTimer);
        clearTimeout(this.retryTimer);

        const neverConnected = !this.clientId && !this.retries;
        if (neverConnected || this.retries >= this.maxRetries) {
            const pending = this.waiting;
            this.waiting = [];
            pending.forEach((p) => p.reject(RustaBaseError.from(err)));
            this.close(true);
            return;
        }

        this.close(false);
        const delay = RETRY_DELAYS_MS[Math.min(this.retries, RETRY_DELAYS_MS.length - 1)];
        this.retries++;
        this.retryTimer = setTimeout(() => this.open(), delay);
    }

    private close(resetRetries = true): void {
        const wasConnected = !!this.clientId;
        clearTimeout(this.connectTimer);
        if (resetRetries) {
            clearTimeout(this.retryTimer);
            this.retries = 0;
            const pending = this.waiting;
            this.waiting = [];
            pending.forEach((p) => p.resolve());
        }
        this.source?.close();
        this.source = null;
        this.clientId = "";
        this.sentTopics = [];
        if (wasConnected || resetRetries) {
            const active = this.activeTopics();
            if (wasConnected) this.onDisconnect?.(active);
        }
    }
}

function baseTopic(key: string): string {
    const i = key.indexOf("?");
    return i < 0 ? key : key.slice(0, i);
}

function sameSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const s = new Set(b);
    return a.every((x) => s.has(x));
}

function clean(query?: Record<string, any>) {
    if (!query) return undefined;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(query)) if (v !== undefined) out[k] = v;
    return out;
}
