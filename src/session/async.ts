import type { Row } from "../types";
import { Session } from "./session";

export interface AsyncSessionOptions {
    /** Persists the serialised session (e.g. React Native AsyncStorage.setItem). */
    save: (value: string) => Promise<void> | void;
    /** Removes the persisted session. Defaults to `save("")`. */
    remove?: () => Promise<void> | void;
    /** Previously saved value, or a promise that resolves to it. */
    initial?: string | null | Promise<string | null | undefined>;
}

/**
 * Session backed by any async storage. Writes run in order, one at a time.
 *
 *     new AsyncSession({
 *       save: (v) => AsyncStorage.setItem("rb_session", v),
 *       initial: AsyncStorage.getItem("rb_session"),
 *     })
 */
export class AsyncSession extends Session {
    private readonly opts: AsyncSessionOptions;
    private chain: Promise<unknown> = Promise.resolve();

    constructor(opts: AsyncSessionOptions) {
        super();
        this.opts = opts;
        this.chain = Promise.resolve(opts.initial)
            .then((raw) => {
                if (!raw) return;
                try {
                    const parsed = JSON.parse(raw);
                    super.set(parsed?.token || "", parsed?.record || null);
                } catch {}
            })
            .catch(() => {});
    }

    /** Resolves once the initial value is loaded and pending writes have finished. */
    ready(): Promise<void> {
        return this.chain.then(() => undefined);
    }

    set(token: string, record?: Row | null): void {
        super.set(token, record);
        const value = token ? JSON.stringify({ token, record: record ?? null }) : "";
        this.enqueue(() => this.opts.save(value));
    }

    clear(): void {
        super.clear();
        this.enqueue(() => (this.opts.remove ? this.opts.remove() : this.opts.save("")));
    }

    private enqueue(task: () => unknown): void {
        this.chain = this.chain.then(task).catch(() => {});
    }
}
