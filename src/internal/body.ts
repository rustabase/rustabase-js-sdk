/** True for browser Blob/File values and React Native `{ uri }` file objects. */
export function isFileLike(value: any): boolean {
    if (value == null) return false;
    if (typeof Blob !== "undefined" && value instanceof Blob) return true;
    const isReactNative =
        (typeof navigator !== "undefined" && (navigator as any).product === "ReactNative") ||
        (typeof globalThis !== "undefined" && !!(globalThis as any).HermesInternal);
    return isReactNative && typeof value === "object" && typeof value.uri === "string";
}

export function isFormData(value: any): value is FormData {
    if (!value || typeof value !== "object") return false;
    return (
        (typeof FormData !== "undefined" && value instanceof FormData) ||
        value.constructor?.name === "FormData"
    );
}

function hasFiles(body: Record<string, any>): boolean {
    return Object.values(body).some((v) =>
        Array.isArray(v) ? v.some(isFileLike) : isFileLike(v),
    );
}

/**
 * Turns a plain object that contains files into multipart form data.
 * Non-file values travel together as one JSON part named `@jsonPayload`
 * so their types (numbers, booleans, arrays) are preserved.
 */
export function prepareBody(body: any): any {
    if (
        typeof FormData === "undefined" ||
        body == null ||
        typeof body !== "object" ||
        isFormData(body) ||
        !hasFiles(body)
    ) {
        return body;
    }

    const form = new FormData();
    const json: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
        if (value === undefined) continue;
        const list = Array.isArray(value) ? value : [value];
        const files = list.filter(isFileLike);
        const plain = list.filter((v) => !isFileLike(v));

        if (!files.length) {
            json[key] = value;
            continue;
        }
        if (Array.isArray(value) && plain.length) {
            // keep existing entries and append the new files
            json[key] = plain;
            const appendKey = key.startsWith("+") || key.endsWith("+") ? key : key + "+";
            files.forEach((f) => form.append(appendKey, f as any));
        } else {
            files.forEach((f) => form.append(key, f as any));
        }
    }

    form.append("@jsonPayload", JSON.stringify(json));
    return form;
}

/** Splits a body into JSON values and files (used by batch requests). */
export function splitBody(body: any): { json: Record<string, any>; files: Record<string, any[]> } {
    const json: Record<string, any> = {};
    const files: Record<string, any[]> = {};
    if (body == null) return { json, files };

    const entries: Array<[string, any]> = [];
    if (isFormData(body)) {
        const grouped: Record<string, any[]> = {};
        body.forEach((v, k) => (grouped[k] = grouped[k] || []).push(v));
        for (const [k, vals] of Object.entries(grouped)) {
            if (k === "@jsonPayload") {
                vals.forEach((v) => Object.assign(json, safeParse(v)));
                continue;
            }
            entries.push([k, vals.length === 1 ? vals[0] : vals]);
        }
    } else {
        entries.push(...Object.entries(body));
    }

    for (const [key, value] of entries) {
        const list = Array.isArray(value) ? value : [value];
        const f = list.filter(isFileLike);
        const plain = list.filter((v) => !isFileLike(v));
        if (!f.length) {
            json[key] = value;
        } else if (Array.isArray(value) && plain.length) {
            json[key] = plain;
            const appendKey = key.startsWith("+") || key.endsWith("+") ? key : key + "+";
            files[appendKey] = (files[appendKey] || []).concat(f);
        } else {
            if (Array.isArray(value) && !plain.length && !f.length) json[key] = [];
            files[key] = (files[key] || []).concat(f);
        }
    }
    return { json, files };
}

function safeParse(v: any): Record<string, any> {
    try {
        return typeof v === "string" ? JSON.parse(v) : {};
    } catch {
        return {};
    }
}
