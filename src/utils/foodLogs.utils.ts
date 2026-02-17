import crypto from "crypto"
/**
 * Percent-encode per OAuth 1.0 rules (RFC 5849).
 */
function oauthEncode(input: string): string {
    return encodeURIComponent(input).replace(
        /[!'()*]/g,
        (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
    );
}

/**
 * Build normalized parameter string: sort by key, then by value, join as k=v pairs with &.
 */
function buildNormalizedParams(params: Record<string, string>): string {
    return Object.keys(params)
        .sort()
        .map((k) => `${oauthEncode(k)}=${oauthEncode(params[k])}`)
        .join("&");
}

/**
 * OAuth base string: METHOD&base_url&normalized_params
 */
function buildBaseString(httpMethod: string, baseUrl: string, normalizedParams: string): string {
    return [
        httpMethod.toUpperCase(),
        oauthEncode(baseUrl),
        oauthEncode(normalizedParams),
    ].join("&");
}

/**
 * HMAC-SHA1 signature (base64)
 */
function signHmacSha1(baseString: string, consumerSecret: string): string {
    const signingKey = `${oauthEncode(consumerSecret)}&`; // token secret empty
    return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

/**
 * Coerce a field to a number safely.
 */
function toNumber(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * FatSecret sometimes returns `results.food` or `servings.serving` as an object or array.
 */
function normalizeToArray<T>(maybeArray: T | T[] | undefined | null): T[] {
    if (!maybeArray) return [];
    return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
}

export {
    oauthEncode,
    buildNormalizedParams,
    buildBaseString,
    signHmacSha1,
    toNumber,
    normalizeToArray,
}