import type { Request, Response } from "express"
import axios from "axios"
import { env } from "../../env.ts"
import crypto from "crypto"
import { db } from "../db/connection.ts"
import {foodLogs} from "../db/schema.ts"
import { buildBaseString, buildNormalizedParams, normalizeToArray, signHmacSha1, toNumber } from "../utils/foodLogs.utils.ts"


export const getFoodByName = async (req: Request, res: Response) => {
    try {
        const food_name = String(req.query.food_name ?? "").trim()
        if (!food_name) {
            return res.status(400).json({ error: "food_name query param is required" })
        }

        // ✅ correct defaults for your desired behavior
        const page_number =
            Number.isFinite(Number(req.query.page_number)) ? String(Number(req.query.page_number)) : "0"

        const max_results =
            Number.isFinite(Number(req.query.max_results)) ? String(Number(req.query.max_results)) : "1"

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

        // ⚠️ FatSecret expects params as strings
        const apiParams: Record<string, string> = {
            method: methodName,
            format: "json",
            search_expression: food_name,
            page_number,
            max_results,
        }

        const allParams = { ...oauthParams, ...apiParams }
        const normalizedParams = buildNormalizedParams(allParams)
        const baseString = buildBaseString("GET", url, normalizedParams)
        const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret)

        const requestParams = { ...apiParams, ...oauthParams, oauth_signature }

        const { data } = await axios.get(url, { params: requestParams, timeout: 15000 })

        const foodsSearch = data?.foods_search
        const foods = normalizeToArray(foodsSearch?.results?.food)

        // ✅ you want ONE food only
        const f = foods[0]
        if (!f) {
            return res.status(404).json({
                query: food_name,
                food: null,
            })
        }

        const servings = normalizeToArray(f?.servings?.serving).map((s: any) => ({
            serving_id: s?.serving_id != null ? String(s.serving_id) : null,
            serving_description: s?.serving_description ?? null,
            calories: toNumber(s?.calories),
        }))

        return res.json({
            query: food_name,
            food: {
                food_id: f?.food_id != null ? String(f.food_id) : null,
                food_name: f?.food_name ?? null,
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
        const food_id = String(req.params.food_id ?? "").trim()
        const serving_id = String(req.params.serving_id ?? "").trim()

        if (!food_id) {
            return res.status(400).json({ error: "food_id route param is required" })
        }
        if (!serving_id) {
            return res.status(400).json({ error: "serving_id route param is required" })
        }

        const oauth_consumer_key = env.FAT_SECRET_CONSUMER_KEY
        const oauth_consumer_secret = env.FAT_SECRET_CONSUMER_SECRET

        if (!oauth_consumer_key || !oauth_consumer_secret) {
            return res.status(500).json({ error: "FatSecret OAUTH credentials are not configured" })
        }

        const url = "https://platform.fatsecret.com/rest/food/v5"
        const methodName = "food.get.v5"

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
            food_id,
        }

        const allParams: Record<string, string> = { ...oauthParams, ...apiParams }
        const normalizedParams = buildNormalizedParams(allParams)
        const baseString = buildBaseString("GET", url, normalizedParams)
        const oauth_signature = signHmacSha1(baseString, oauth_consumer_secret)

        const requestParams = { ...apiParams, ...oauthParams, oauth_signature }

        const { data } = await axios.get(url, {
            params: requestParams,
            timeout: 15000,
        })

        const food = data?.food
        if (!food) {
            return res.status(404).json({ error: "Food not found", details: data })
        }

        const servingsRaw = food?.servings?.serving
        const servingsArr = normalizeToArray(servingsRaw)

        const match = servingsArr.find((s: any) => String(s?.serving_id ?? "") === serving_id)
        if (!match) {
            return res.status(404).json({
                error: "Serving not found for this food",
                food_id: String(food?.food_id ?? food_id),
                serving_id,
            })
        }

        return res.json({
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
        })
    } catch (e: any) {
        const status = e?.response?.status
        const details = e?.response?.data ?? e?.message ?? String(e)

        return res.status(status ?? 500).json({
            error: "Failed to fetch food details from FatSecret",
            details,
        })
    }
}
