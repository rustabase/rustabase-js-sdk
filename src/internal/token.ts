function decodeBase64Url(input: string): string {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    if (typeof atob === "function") {
        const bin = atob(padded);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }
    // Node without atob (very old versions)
    return (globalThis as any).Buffer.from(padded, "base64").toString("utf8");
}

/** Reads the claims of a JWT without verifying it. Returns `{}` for anything invalid. */
export function readClaims(token: string): Record<string, any> {
    if (!token) return {};
    const part = token.split(".")[1];
    if (!part) return {};
    try {
        const claims = JSON.parse(decodeBase64Url(part));
        return claims && typeof claims === "object" ? claims : {};
    } catch {
        return {};
    }
}

/**
 * True when the token is missing, malformed, or expires within `leewaySeconds`.
 */
export function tokenExpired(token: string, leewaySeconds = 0): boolean {
    const claims = readClaims(token);
    if (!Object.keys(claims).length) return true;
    if (claims.exp === undefined || claims.exp === null) return false;
    if (typeof claims.exp !== "number" || !isFinite(claims.exp)) return true;
    return claims.exp - leewaySeconds <= Date.now() / 1000;
}
