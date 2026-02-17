import type { Request, Response } from "express"
import axios from "axios"
import { env } from "../../env.ts"
import crypto from "crypto"
import { db } from "../db/connection.ts"
import {foodLogs} from "../db/schema.ts"
import { buildBaseString, buildNormalizedParams, normalizeToArray, signHmacSha1, toNumber } from "../utils/foodLogs.utils.ts"

export type FatSecretServingDetails = {
    food_id: string;
    food_name: string | null;
    serving: {
        serving_id: string;
        serving_description: string | null;
        metric_serving_amount: number;
        metric_serving_unit: string | null;
        calories: number;
        carbs: number;
        protein: number;
        fat: number;
    };
};

export async function fetchFatSecretServingDetails(
    food_id: string,
    serving_id: string
): Promise<FatSecretServingDetails> {
    const oauth_consumer_key = env.FAT_SECRET_CONSUMER_KEY;
    const oauth_consumer_secret = env.FAT_SECRET_CONSUMER_SECRET;

    if (!oauth_consumer_key || !oauth_consumer_secret) {
        throw new Error("FatSecret OAUTH credentials are not configured");
    }

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
        food_id,
    };

    const allParams = { ...oauthParams, ...apiParams };
    const normalizedParams = buildNormalizedParams(allParams);
    const baseString = buildBaseString("GET", url, normalizedParams);
    const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret);

    const requestParams = { ...apiParams, ...oauthParams, oauth_signature };

    const { data } = await axios.get(url, { params: requestParams, timeout: 15000 });

    const food = data?.food;
    if (!food) throw new Error("Food not found");

    const servingsArr = normalizeToArray(food?.servings?.serving);
    const match = servingsArr.find((s: any) => String(s?.serving_id ?? "") === serving_id);
    if (!match) throw new Error("Serving not found for this food");

    return {
        food_id: String(food?.food_id ?? food_id),
        food_name: food?.food_name ?? null,
        serving: {
            serving_id: String(match?.serving_id ?? serving_id),
            serving_description: match?.serving_description ?? null,
            metric_serving_amount: toNumber(match?.metric_serving_amount),
            metric_serving_unit: match?.metric_serving_unit ?? null,
            calories: toNumber(match?.calories),
            carbs: toNumber(match?.carbohydrate),
            protein: toNumber(match?.protein),
            fat: toNumber(match?.fat),
        },
    };
}

export const getFoodByQuery = async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q ?? "").trim()
        if (!q) {
            return res.status(400).json({ error: "q query param is required" })
        }

        const page_number =
            Number.isFinite(Number(req.query.page_number)) ? String(Number(req.query.page_number)) : "0"

        // ✅ increase FOOD results so branded items can appear
        const max_results =
            Number.isFinite(Number(req.query.max_results)) ? String(Number(req.query.max_results)) : "20"

        const oauth_consumer_key = env.FAT_SECRET_CONSUMER_KEY
        const oauth_consumer_secret = env.FAT_SECRET_CONSUMER_SECRET

        if (!oauth_consumer_key || !oauth_consumer_secret) {
            return res.status(500).json({ error: "FatSecret OAUTH credentials are not configured" })
        }

        const url = "https://platform.fatsecret.com/rest/foods/search/v4"
        const methodName = "foods.search.v4"

        const oauthParams: Record<string, string> = {
            oauth_consumer_key,
            oauth_nonce: crypto.randomBytes(16).toString("hex"),
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: "1.0",
        }

        const apiParams: Record<string, string> = {
            method: methodName,
            format: "json",
            search_expression: q, // ✅ user can type "Heinz Baked Beans"
            page_number,
            max_results,
        }

        const allParams = { ...oauthParams, ...apiParams }
        const normalizedParams = buildNormalizedParams(allParams)
        const baseString = buildBaseString("GET", url, normalizedParams)
        const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret)

        const requestParams = { ...apiParams, ...oauthParams, oauth_signature }

        const { data } = await axios.get(url, { params: requestParams, timeout: 15000 })

        const foods = normalizeToArray(data?.foods_search?.results?.food)
        const f = foods[0] // ✅ pick best match per FatSecret ordering

        if (!f) {
            return res.status(404).json({ query: q, food: null })
        }

        // ✅ DO NOT SLICE -> return ALL servings
        const servings = normalizeToArray(f?.servings?.serving).map((s: any) => ({
            serving_id: s?.serving_id != null ? String(s.serving_id) : null,
            serving_description: s?.serving_description ?? null,
            metric_serving_amount: toNumber(s?.metric_serving_amount),
            metric_serving_unit: s?.metric_serving_unit ?? null,
            calories: toNumber(s?.calories),
        }))


        // ✅ brand included in food_name
        const displayName = [f?.brand_name, f?.food_name].filter(Boolean).join(" ")

        return res.json({
            query: q,
            food: {
                food_id: f?.food_id != null ? String(f.food_id) : null,
                food_name: displayName || null,
                servings,
            },
        })
    } catch (e: any) {
        const status = e?.response?.status
        const details = e?.response?.data ?? e?.message ?? String(e)
        return res.status(status ?? 500).json({
            error: "Failed to fetch food data from FatSecret",
            details,
        })
    }
}

export const getFoodDetailsByServingId = async (req: Request, res: Response) => {
    try {
        const food_id = String(req.params.food_id ?? "").trim();
        const serving_id = String(req.params.serving_id ?? "").trim();

        if (!food_id) return res.status(400).json({ error: "food_id route param is required" });
        if (!serving_id) return res.status(400).json({ error: "serving_id route param is required" });

        const details = await fetchFatSecretServingDetails(food_id, serving_id);
        return res.json(details);
    } catch (e: any) {
        return res.status(500).json({ error: "Failed to fetch food details", details: e?.message ?? String(e) });
    }
};

export const postFoodLog = async (req: Request, res: Response) => {
    try {
        const food_id = String(req.body?.food_id ?? "").trim()
        const serving_id = String(req.body?.serving_id ?? "").trim()

        if (!food_id) return res.status(400).json({ error: "food_id route param is required" })
        if (!serving_id) return res.status(400).json({ error: "serving_id route param is required" })

        const profile_id = String(req.body?.profile_id ?? "").trim()
        const meal_type = String(req.body?.meal_type ?? "").trim().toUpperCase()
        const number_of_servings_raw = req.body?.number_of_servings
        const number_of_servings =
            number_of_servings_raw == null ? 1 : Number(number_of_servings_raw)

        if (!profile_id) return res.status(400).json({ error: "profile_id is required" })

        const allowedMeals = new Set(["BREAKFAST", "LUNCH", "DINNER", "SNACK"])
        if (!allowedMeals.has(meal_type)) {
            return res.status(400).json({
                error: "meal_type must be one of BREAKFAST, LUNCH, DINNER, SNACK",
                got: meal_type,
            })
        }

        if (!Number.isFinite(number_of_servings) || number_of_servings <= 0) {
            return res.status(400).json({ error: "number_of_servings must be a number > 0" })
        }

        const details = await fetchFatSecretServingDetails(food_id, serving_id)

        const unit = (details.serving.metric_serving_unit ?? "").trim().toLowerCase()
        if (unit !== "g") {
            return res.status(400).json({
                error: "This serving is not in grams, cannot store into serving_size_g safely",
                unit: details.serving.metric_serving_unit,
                metric_serving_amount: details.serving.metric_serving_amount,
            })
        }

        const round2 = (n: number) => Math.round(n * 100) / 100

        const serving_size_g = round2(details.serving.metric_serving_amount)

        const calories_kcal = Math.round(details.serving.calories * number_of_servings)
        const carbohydrates_g = round2(details.serving.carbs * number_of_servings)
        const protein_g = round2(details.serving.protein * number_of_servings)
        const fat_g = round2(details.serving.fat * number_of_servings)

        const food_name = String(details.food_name ?? "").trim()
        if (!food_name) {
            return res.status(500).json({ error: "FatSecret response missing food_name" })
        }

        const inserted = await db
            .insert(foodLogs)
            .values({
                profile_id,
                food_name,
                serving_size_g,
                number_of_servings: Math.floor(number_of_servings),
                meal_type: meal_type as any,
                calories_kcal,
                carbohydrates_g,
                protein_g,
                fat_g,
                source_type: "FAT_SECRET_API",
                source_id: `${details.food_id}:${details.serving.serving_id}`,
            })
            .returning()

        return res.status(201).json({
            ok: true,
            food_log: inserted?.[0] ?? null,
        })
    } catch (e: any) {
        const status = e?.response?.status
        const details = e?.response?.data ?? e?.message ?? String(e)
        return res.status(status ?? 500).json({
            error: "Failed to create food log",
            details,
        })
    }
}
