import type { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { env } from "../../env.ts";

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
        const methodName = "foods.search.v4";

        const oauthParams: Record<string, string> = {
            oauth_consumer_key,
            oauth_nonce: crypto.randomBytes(16).toString("hex"),
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: "1.0",
        };

        const apiParams: Record<string, string> = {
            method: methodName,
            format: "json",
            search_expression: food_name,
            page_number: "0",
            max_results: "20",
        };

        const allParams: Record<string, string> = { ...oauthParams, ...apiParams };

        const normalizedParams = buildNormalizedParams(allParams);
        const baseString = buildBaseString("GET", url, normalizedParams);
        const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret);

        const requestParams = { ...apiParams, ...oauthParams, oauth_signature };

        const { data } = await axios.get(url, {
            params: requestParams,
            timeout: 15000,
        });

        const foodsSearch = data?.foods_search;
        const foods = normalizeToArray(foodsSearch?.results?.food);

        const mapped = foods.map((f: any) => {
            const servings = normalizeToArray(f?.servings?.serving);
            const defaultServing =
                servings.find((s: any) => String(s?.is_default) === "1") ?? servings[0];

            return {
                food_id: f?.food_id ? String(f.food_id) : null,
                food_name: f?.food_name ?? null,
                brand_name: f?.brand_name ?? null,
                food_type: f?.food_type ?? null,
                serving: defaultServing
                    ? {
                        serving_id: defaultServing?.serving_id ? String(defaultServing.serving_id) : null,
                        serving_description: defaultServing?.serving_description ?? null,
                        calories: toNumber(defaultServing?.calories),
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

export const getFoodById = async (req: Request, res: Response) => {
    try {
        const food_id = String(req.params.food_id ?? "").trim();
        if (!food_id) {
            return res.status(400).json({ error: "food_id route param is required" });
        }

        const oauth_consumer_key = env.FAT_SECRET_CONSUMER_KEY;
        const oauth_consumer_secret = env.FAT_SECRET_CONSUMER_SECRET;

        if (!oauth_consumer_key || !oauth_consumer_secret) {
            return res.status(500).json({ error: "FatSecret OAUTH credentials are not configured" });
        }

        // FatSecret v4 get-by-id endpoint + method
        const url = "https://platform.fatsecret.com/rest/food/v5";
        const methodName = "food.get.v5";

        const oauthParams: Record<string, string> = {
            oauth_consumer_key,
            oauth_nonce: crypto.randomBytes(16).toString("hex"),
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: "1.0",
        };

        const apiParams: Record<string, string> = {
            method: methodName,
            format: "json",
            food_id, // required by food.get.v4
        };

        const allParams: Record<string, string> = { ...oauthParams, ...apiParams };

        const normalizedParams = buildNormalizedParams(allParams);
        const baseString = buildBaseString("GET", url, normalizedParams);
        const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret);

        const requestParams = { ...apiParams, ...oauthParams, oauth_signature };

        const { data } = await axios.get(url, {
            params: requestParams,
            timeout: 15000,
        });

        // v4 response: data.food contains details + servings
        const food = data?.food;
        if (!food) {
            return res.status(404).json({ error: "Food not found", details: data });
        }

        const servingsRaw = food?.servings?.serving;
        const servings = normalizeToArray(servingsRaw).map((s: any) => ({
            serving_id: s?.serving_id ? String(s.serving_id) : null,
            serving_description: s?.serving_description ?? null,
            metric_serving_amount: toNumber(s?.metric_serving_amount),
            metric_serving_unit: s?.metric_serving_unit ?? null,

            calories: toNumber(s?.calories),
            carbs: toNumber(s?.carbohydrate),
            protein: toNumber(s?.protein),
            fat: toNumber(s?.fat),

            // optional useful fields if you want later:
            // number_of_units: toNumber(s?.number_of_units),
            // measurement_description: s?.measurement_description ?? null,
            // is_default: s?.is_default ? Number(s.is_default) : null,
        }));

        return res.json({
            food_id: food?.food_id ? String(food.food_id) : food_id,
            food_name: food?.food_name ?? null,
            brand_name: food?.brand_name ?? null,
            food_type: food?.food_type ?? null,
            servings,
        });
    } catch (e: any) {
        const status = e?.response?.status;
        const details = e?.response?.data ?? e?.message ?? String(e);

        return res.status(status ?? 500).json({
            error: "Failed to fetch food details from FatSecret",
            details,
        });
    }
};
