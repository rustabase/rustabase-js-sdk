/** Any record returned by the server. */
export interface Row {
    id: string;
    collectionId: string;
    collectionName: string;
    [field: string]: any;
}

export type Json = Record<string, any>;
export type Body = Json | FormData;

export interface RetryOptions {
    attempts?: number;
    delay?: number;
    statuses?: number[];
    /** Allow retries for non-idempotent writes. Disabled by default. */
    unsafe?: boolean;
}

/** Options accepted by every request. */
export interface RequestOptions {
    /** Extra query string values. */
    query?: Json;
    /** Extra headers. */
    headers?: Record<string, string>;
    /** Request body (objects are sent as JSON, or multipart when they contain files). */
    body?: any;
    method?: string;
    /**
     * Requests with the same key cancel each other (only the newest one wins).
     * Defaults to `METHOD + path`. Pass `null` to never auto-cancel.
     */
    requestKey?: string | null;
    /** Custom fetch implementation for this call. */
    fetch?: typeof fetch;
    signal?: AbortSignal;
    /** Abort after this many milliseconds. */
    timeout?: number;
    /** Retry transient failures. */
    retry?: number | RetryOptions;
    [fetchOption: string]: any;
}

/** Shared query options for record reads. */
export interface ReadOptions extends RequestOptions {
    expand?: string;
    fields?: string;
}

export interface ListOptions extends ReadOptions {
    page?: number;
    perPage?: number;
    filter?: string;
    sort?: string;
    /** Skip counting the total (faster). */
    skipTotal?: boolean;
}

export interface AllOptions extends Omit<ListOptions, "page" | "perPage"> {
    /** Rows fetched per request while walking every page. Default 1000. */
    chunk?: number;
}

export interface Page<T = Row> {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: T[];
}

export interface AuthResult<T = Row> {
    token: string;
    record: T;
    meta?: Json;
}

export interface HealthData extends Json {
    canBackup?: boolean;
    realIP?: string;
    cpuCores?: number;
    memoryTotal?: number;
}

export interface HealthResult {
    code: number;
    message: string;
    data: HealthData;
}

export interface AuthMethods {
    mfa: { enabled: boolean; duration: number };
    otp: { enabled: boolean; duration: number };
    password: { enabled: boolean; identityFields: string[] };
    oauth2: { enabled: boolean; providers: OAuthProvider[] };
}

export interface OAuthProvider {
    name: string;
    displayName: string;
    state: string;
    authURL: string;
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: string;
}

export interface FileUrlOptions {
    /** Thumb size, e.g. "100x100". */
    thumb?: string;
    /** Force the browser to download instead of display. */
    download?: boolean;
    /** Access token for protected files (see `rb.files.token()`). */
    token?: string;
    [key: string]: any;
}

export interface BatchResult {
    status: number;
    body: any;
}

export interface RealtimeEvent<T = Row> {
    action: "create" | "update" | "delete" | string;
    record: T;
}

export type Unsubscribe = () => Promise<void>;
