export interface CookieOptions {
    name?: string;
    path?: string;
    domain?: string;
    expires?: Date;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None" | boolean;
}

const VALID_NAME = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

/** Reads one cookie value from a `Cookie` header string. */
export function readCookie(header: string, name: string): string | undefined {
    for (const part of (header || "").split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        if (part.slice(0, eq).trim() !== name) continue;
        let value = part.slice(eq + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }
    return undefined;
}

/** Builds a `Set-Cookie` header value. */
export function writeCookie(name: string, value: string, opts: CookieOptions = {}): string {
    if (!VALID_NAME.test(name)) throw new TypeError("Invalid cookie name.");
    const encoded = encodeURIComponent(value);
    if (encoded && !VALID_NAME.test(encoded)) throw new TypeError("Invalid cookie value.");

    const parts = [`${name}=${encoded}`];
    if (opts.maxAge != null) {
        if (!Number.isFinite(opts.maxAge)) throw new TypeError("Invalid cookie maxAge.");
        parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
    }
    if (opts.domain) parts.push(`Domain=${attribute("domain", opts.domain)}`);
    if (opts.path) parts.push(`Path=${attribute("path", opts.path)}`);
    if (opts.expires) {
        if (!(opts.expires instanceof Date) || isNaN(opts.expires.getTime())) {
            throw new TypeError("Invalid cookie expires.");
        }
        parts.push(`Expires=${opts.expires.toUTCString()}`);
    }
    if (opts.httpOnly) parts.push("HttpOnly");
    if (opts.secure) parts.push("Secure");
    if (opts.sameSite) {
        const sameSite =
            opts.sameSite === true
                ? "Strict"
                : SAME_SITE[String(opts.sameSite).toLowerCase()];
        if (!sameSite) throw new TypeError("Invalid cookie sameSite.");
        parts.push(`SameSite=${sameSite}`);
    }
    return parts.join("; ");
}

const SAME_SITE: Record<string, string> = { strict: "Strict", lax: "Lax", none: "None" };

// Attribute values end at ";" and the header ends at a line break, so either
// one inside a path or domain would let a caller add their own attributes
// (for example a wider Domain) to the session cookie.
const SAFE_ATTRIBUTE = /^[\u0021-\u003a\u003c-\u007e]+$/;

function attribute(kind: string, value: string): string {
    if (typeof value !== "string" || !SAFE_ATTRIBUTE.test(value)) {
        throw new TypeError(`Invalid cookie ${kind}.`);
    }
    return value;
}
