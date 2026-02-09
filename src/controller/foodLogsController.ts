import type { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { env } from "../../env.ts";

/**
 * Percent-encode per OAuth 1.0 rules (RFC 5849).
 */
function oauthEncode(input: string): string {
    return encodeURIComponent(input)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
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
    // token secret is empty for FatSecret's basic OAuth1 flow here
    const signingKey = `${oauthEncode(consumerSecret)}&`;
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
 * FatSecret sometimes returns `servings.serving` as an object or an array depending on count.
 */
function normalizeToArray<T>(maybeArray: T | T[] | undefined | null): T[] {
    if (!maybeArray) return [];
    return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
}

export const getFoodByName = async (req: Request, res: Response) => {
    try {
        const food_name = String(req.query.food_name ?? "").trim();
        if (!food_name) {
            return res.status(400).json({ error: "food_name query param is required" });
        }

        const oauth_consumer_key = env.FAT_SECRET_CONSUMER_KEY;
        const oauth_consumer_secret = env.FAT_SECRET_CONSUMER_SECRET;

        if (!oauth_consumer_key || !oauth_consumer_secret) {
            return res.status(500).json({ error: "FatSecret OAUTH credentials are not configured" });
        }

        const url = "https://platform.fatsecret.com/rest/foods/search/v4";

        // FatSecret method name for this endpoint:
        const methodName = "foods.search.v4";

        // OAuth required params
        const oauthParams: Record<string, string> = {
            oauth_consumer_key,
            oauth_nonce: crypto.randomBytes(16).toString("hex"),
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: "1.0",
        };

        // API call params (these MUST be included in signature calculation)
        const apiParams: Record<string, string> = {
            method: methodName,
            format: "json",
            search_expression: food_name,
            page_number: "0",
            max_results: "20",
            // optional flags:
            // include_sub_categories: "true",
            // flag_default_serving: "true",
            // region: "PH", // if you want; otherwise defaults to US
            // language: "en",
        };

        // Combine all params for signing
        const allParams: Record<string, string> = {
            ...oauthParams,
            ...apiParams,
        };

        const normalizedParams = buildNormalizedParams(allParams);
        const baseString = buildBaseString("GET", url, normalizedParams);
        const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret);

        // Final request params include the signature
        const requestParams = {
            ...apiParams,
            ...oauthParams,
            oauth_signature,
        };

        const { data } = await axios.get(url, {
            params: requestParams,
            timeout: 15000,
        });

        // ---- Parse response (JSON) ----
        // Typical shape:
        // data.foods_search.total_results
        // data.foods_search.results.food[] (sometimes)
        const foodsSearch = data?.foods_search;
        const results = foodsSearch?.results;
        const foods = normalizeToArray(results?.food);

        // Map to a clean response that includes macros
        const mapped = foods.map((f: any) => {
            const servings = normalizeToArray(f?.servings?.serving);

            // If you requested flag_default_serving=true, you can pick serving where is_default==1
            // Otherwise we’ll pick the first one.
            const defaultServing =
                servings.find((s: any) => String(s?.is_default) === "1") ?? servings[0];

            return {
                food_id: f?.food_id ? String(f.food_id) : null,
                food_name: f?.food_name ?? null,
                brand_name: f?.brand_name ?? null,
                food_type: f?.food_type ?? null,
                food_url: f?.food_url ?? null,

                serving: defaultServing
                    ? {
                        serving_id: defaultServing?.serving_id ? String(defaultServing.serving_id) : null,
                        serving_description: defaultServing?.serving_description ?? null,

                        calories: toNumber(defaultServing?.calories),
                        carbs: toNumber(defaultServing?.carbohydrate),
                        protein: toNumber(defaultServing?.protein),
                        fat: toNumber(defaultServing?.fat),

                        // optional extras if you want them:
                        // fiber: toNumber(defaultServing?.fiber),
                        // sugar: toNumber(defaultServing?.sugar),
                        // sodium: toNumber(defaultServing?.sodium),
                        // metric_serving_amount: toNumber(defaultServing?.metric_serving_amount),
                        // metric_serving_unit: defaultServing?.metric_serving_unit ?? null,
                    }
                    : null,
            };
        });

        return res.json({
            query: food_name,
            total_results: toNumber(foodsSearch?.total_results) ?? null,
            page_number: toNumber(foodsSearch?.page_number) ?? 0,
            max_results: toNumber(foodsSearch?.max_results) ?? 20,
            results: mapped,
        });
    } catch (e: any) {
        const status = e?.response?.status;
        const details = e?.response?.data ?? e?.message ?? String(e);

        return res.status(status ?? 500).json({
            error: "Failed to fetch food data from FatSecret",
            details,
        });
    }
};
