import type { RustaBase } from "../client";
import { RustaBaseError } from "../errors";
import { seg } from "../internal/encode";
import { openPopup } from "../internal/popup";
import { readClaims } from "../internal/token";
import { SUPERUSERS } from "../protocol";
import { Realtime } from "../realtime/realtime";
import type {
    AuthMethods,
    AuthResult,
    Body,
    Json,
    ReadOptions,
    RealtimeEvent,
    RequestOptions,
    Row,
    Unsubscribe,
} from "../types";
import { Crud, readQuery } from "./crud";

/** Records of one collection: `rb.from("posts")`. */
export class Table<T extends Row = Row> extends Crud<T> {
    readonly collection: string;

    constructor(rb: RustaBase, collection: string) {
        super(rb, "/api/collections/" + seg(collection) + "/records");
        this.collection = collection;
    }

    /** Base path of the collection (without `/records`). */
    protected get base(): string {
        return "/api/collections/" + seg(this.collection);
    }

    /** Updates a row and refreshes the saved session if it is the signed-in record. */
    async update(id: string, data: Body = {}, options: ReadOptions = {}): Promise<T> {
        const row = await super.update(id, data, options);
        const current = this.rb.session.record;
        if (current?.id === row?.id && this.matchesCollection(current)) {
            const expand = { ...(current.expand || {}), ...(row.expand || {}) };
            this.rb.session.set(this.rb.session.token, { ...current, ...row, expand });
        }
        return row;
    }

    /** Deletes a row and signs out if it was the signed-in record. */
    async remove(id: string, options: RequestOptions = {}): Promise<true> {
        await super.remove(id, options);
        const current = this.rb.session.record;
        if (current?.id === id && this.matchesCollection(current)) {
            this.rb.session.clear();
        }
        return true;
    }

    /**
     * Live updates. Watch every row with "*" or a single row by id.
     *
     *     const stop = await rb.from("posts").subscribe("*", (e) => console.log(e.action, e.record));
     */
    subscribe(
        target: string,
        callback: (event: RealtimeEvent<T>) => void,
        options?: ReadOptions & { filter?: string },
    ): Promise<Unsubscribe> {
        if (!target) throw new Error('subscribe() needs a target: "*" or a row id.');
        const topic = this.collection + "/" + target;
        return this.rb.realtime.subscribe(
            topic,
            callback as any,
            options && readQuery(options),
        );
    }

    /** Stops live updates for one target, or for the whole collection when omitted. */
    unsubscribe(target?: string): Promise<void> {
        if (target) return this.rb.realtime.unsubscribe(this.collection + "/" + target);
        return this.rb.realtime.unsubscribeByPrefix(this.collection);
    }

    private matchesCollection(record: Row): boolean {
        return (
            record.collectionId === this.collection ||
            record.collectionName === this.collection
        );
    }
}

export interface PasswordSignInOptions extends ReadOptions {
    /**
     * Refresh the token automatically when it is this many seconds from expiring.
     */
    keepAlive?: number;
    mfaId?: string;
}

export interface OAuthSignInOptions extends ReadOptions {
    provider: string;
    scopes?: string[];
    /** Values for the new record when the account is created on first sign-in. */
    createData?: Json;
    /**
     * Opens the provider's sign-in page. Defaults to a popup window.
     * Use it for custom flows, e.g. React Native `Linking.openURL`.
     */
    openUrl?: (url: string) => void | Promise<void>;
}

/** An auth collection: records plus every sign-in flow. `rb.auth("users")`. */
export class AuthTable<T extends Row = Row> extends Table<T> {
    /** Which sign-in methods the collection allows. */
    methods(options: RequestOptions = {}): Promise<AuthMethods> {
        return this.rb.request(this.base + "/auth-methods", {
            ...options,
            method: "GET",
        });
    }

    /** Signs in with email/username and password. */
    async signInWithPassword(
        identity: string,
        password: string,
        options: PasswordSignInOptions = {},
    ): Promise<AuthResult<T>> {
        const { keepAlive, mfaId, ...rest } = options;
        const send = (o: ReadOptions) =>
            this.rb.request(this.base + "/auth-with-password", {
                ...readQuery(o),
                method: "POST",
                body: { identity, password, ...(mfaId ? { mfaId } : {}) },
                __noKeepAlive: true,
            });

        const result = this.save(await send(rest));

        if (keepAlive) {
            this.rb._setKeepAlive(keepAlive, async () => {
                try {
                    await this.refresh({ requestKey: null });
                } catch (err) {
                    // superuser tokens can't always be refreshed — sign in again
                    if (this.collection !== SUPERUSERS && !this.rb.session.isSuperuser)
                        throw err;
                    this.save(await send({ requestKey: null }));
                }
            });
        }
        return result;
    }

    /** Emails a one-time code. Returns the `otpId` needed by `signInWithOtp`. */
    requestOtp(email: string, options: RequestOptions = {}): Promise<{ otpId: string }> {
        return this.rb.request(this.base + "/request-otp", {
            ...options,
            method: "POST",
            body: { email },
        });
    }

    /** Signs in with a one-time code. */
    async signInWithOtp(
        otpId: string,
        code: string,
        options: ReadOptions & { mfaId?: string } = {},
    ): Promise<AuthResult<T>> {
        const { mfaId, ...rest } = options;
        return this.save(
            await this.rb.request(this.base + "/auth-with-otp", {
                ...readQuery(rest),
                method: "POST",
                body: { otpId, password: code, ...(mfaId ? { mfaId } : {}) },
            }),
        );
    }

    /**
     * Signs in with an OAuth2 provider (Google, GitHub, Apple...) using a popup
     * and a live connection that receives the result. Call it from a click
     * handler so the popup isn't blocked.
     */
    signInWithOAuth(options: OAuthSignInOptions): Promise<AuthResult<T>> {
        const {
            provider: providerName,
            scopes,
            createData,
            openUrl,
            ...requestOptions
        } = options;

        // open the popup synchronously (Safari blocks popups opened after an await)
        let popup: Window | null = openUrl ? null : openPopup();
        const live = new Realtime(this.rb);
        const cleanup = () => {
            popup?.close();
            live.disconnect();
        };

        return new Promise<AuthResult<T>>(async (resolve, reject) => {
            const fail = (err: unknown) => {
                cleanup();
                reject(RustaBaseError.from(err));
            };

            try {
                const methods = await this.methods({
                    requestKey: requestOptions.requestKey,
                });
                const provider = methods.oauth2.providers.find(
                    (p) => p.name === providerName,
                );
                if (!provider)
                    throw new Error(`Unknown sign-in provider "${providerName}".`);

                const redirectUrl = this.rb.url("/api/oauth2-redirect");

                live.onDisconnect = (active) => {
                    if (active.length)
                        fail(new Error("The live connection was interrupted."));
                };

                await live.subscribe("@oauth2", async (e: any) => {
                    try {
                        if (!e?.state || e.state !== live.clientId) {
                            throw new Error(
                                "The sign-in response didn't match this request.",
                            );
                        }
                        if (e.error || !e.code) {
                            throw new Error(
                                "The provider returned an error: " +
                                    (e.error || "no code"),
                            );
                        }
                        const result = await this.signInWithOAuthCode(
                            provider.name,
                            e.code,
                            provider.codeVerifier,
                            redirectUrl,
                            createData,
                            requestOptions,
                        );
                        cleanup();
                        resolve(result);
                    } catch (err) {
                        fail(err);
                    }
                });

                const authUrl = new URL(
                    provider.authURL + encodeURIComponent(redirectUrl),
                );
                authUrl.searchParams.set("state", live.clientId);
                if (scopes?.length) authUrl.searchParams.set("scope", scopes.join(" "));
                const target = authUrl.toString();

                if (openUrl) {
                    await openUrl(target);
                } else if (popup) {
                    popup.location.href = target;
                } else {
                    popup = openPopup(target);
                }
            } catch (err) {
                fail(err);
            }
        });
    }

    /** Finishes an OAuth2 sign-in when you handle the redirect yourself. */
    async signInWithOAuthCode(
        provider: string,
        code: string,
        codeVerifier: string,
        redirectUrl: string,
        createData?: Json,
        options: ReadOptions & { mfaId?: string } = {},
    ): Promise<AuthResult<T>> {
        const { mfaId, ...rest } = options;
        return this.save(
            await this.rb.request(this.base + "/auth-with-oauth2", {
                ...readQuery(rest),
                method: "POST",
                body: {
                    provider,
                    code,
                    codeVerifier,
                    redirectURL: redirectUrl,
                    createData,
                    ...(mfaId ? { mfaId } : {}),
                },
            }),
        );
    }

    /** Gets a fresh token for the signed-in record. */
    async refresh(options: ReadOptions = {}): Promise<AuthResult<T>> {
        return this.save(
            await this.rb.request(this.base + "/auth-refresh", {
                ...readQuery(options),
                method: "POST",
                __noKeepAlive: true,
            }),
        );
    }

    /**
     * Superusers only: returns a client signed in as another record.
     * The current client's session is not changed.
     */
    async impersonate(recordId: string, durationSeconds = 0, options: ReadOptions = {}) {
        const { RustaBase } = await import("../client");
        const { MemorySession } = await import("../session/session");
        const res: AuthResult<T> = await this.rb.request(
            this.base + "/impersonate/" + seg(recordId),
            {
                ...readQuery(options),
                method: "POST",
                body: { duration: durationSeconds },
                headers: {
                    ...(options.headers || {}),
                    Authorization: this.rb.session.token,
                },
            },
        );
        const client = new RustaBase(this.rb.baseUrl, {
            session: new MemorySession(),
            lang: this.rb.lang,
        });
        client.session.set(res.token, res.record);
        return client;
    }

    requestPasswordReset(email: string, options: RequestOptions = {}): Promise<true> {
        return this.post("/request-password-reset", { email }, options);
    }

    confirmPasswordReset(
        token: string,
        password: string,
        passwordConfirm: string,
        options: RequestOptions = {},
    ): Promise<true> {
        return this.post(
            "/confirm-password-reset",
            { token, password, passwordConfirm },
            options,
        );
    }

    requestVerification(email: string, options: RequestOptions = {}): Promise<true> {
        return this.post("/request-verification", { email }, options);
    }

    /** Confirms an email address. Marks the signed-in record as verified when it matches. */
    async confirmVerification(
        token: string,
        options: RequestOptions = {},
    ): Promise<true> {
        await this.post("/confirm-verification", { token }, options);
        const claims = readClaims(token);
        const current = this.rb.session.record;
        if (
            current &&
            !current.verified &&
            current.id === claims.id &&
            current.collectionId === claims.collectionId
        ) {
            this.rb.session.set(this.rb.session.token, { ...current, verified: true });
        }
        return true;
    }

    requestEmailChange(newEmail: string, options: RequestOptions = {}): Promise<true> {
        return this.post("/request-email-change", { newEmail }, options);
    }

    /** Confirms an email change. Signs out when it applies to the signed-in record. */
    async confirmEmailChange(
        token: string,
        password: string,
        options: RequestOptions = {},
    ): Promise<true> {
        await this.post("/confirm-email-change", { token, password }, options);
        const claims = readClaims(token);
        const current = this.rb.session.record;
        if (
            current &&
            current.id === claims.id &&
            current.collectionId === claims.collectionId
        ) {
            this.rb.session.clear();
        }
        return true;
    }

    private async post(path: string, body: Json, options: RequestOptions): Promise<true> {
        await this.rb.request(this.base + path, { ...options, method: "POST", body });
        return true;
    }

    private save(result: AuthResult<T>): AuthResult<T> {
        this.rb.session.set(result?.token || "", (result?.record as Row) || null);
        return result;
    }
}
