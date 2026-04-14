import type { Request, Response } from "express";
import type { File } from "multer";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { db } from "../db/connection.ts";
import { foodLogs } from "../db/schema.ts";
import getProfileIdByAccountId from "../utils/auth.utils.ts";
import { recalculateDailyTotals } from "../utils/dailyTotalsUtils.ts";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});

const responseSchema = z.object({
  calories_kcal: z.number().min(0).nullable(),
  carbs_g: z.number().min(0).nullable(),
  protein_g: z.number().min(0).nullable(),
  fat_g: z.number().min(0).nullable(),
  serving_size_g: z.number().min(0).nullable(),
  serving_size_ml: z.number().min(0).nullable(),
  serving_description: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const postLabelMacrosOnly = async (
  req: Request & { file?: File },
  res: Response,
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Image file is required",
      });
    }

    const imageBytes: Buffer = req.file.buffer;
    const mimeType: string = req.file.mimetype || "image/jpeg";

    const prompt = `
            You are reading a Nutrition Facts label image.
            Extract ONLY these values PER SERVING:
            - Calories (kcal)
            - Serving Size (g)
            - Serving Size (mL) (only if label uses mL, e.g., water)
            - Serving Description (slice, cup, etc)
            - Total Carbohydrate (g)
            - Protein (g)
            - Total Fat (g)
            
            Rules:
            1) Do NOT estimate. If unclear, output null.
            2) Output valid JSON matching:
            {"calories_kcal": number|null, "carbs_g": number|null, "protein_g": number|null, "fat_g": number|null, "serving_size_g": number|null, "serving_size_ml": number|null, "serving_description": string|null, "confidence": number}
            3) Numbers only.
            4) Output JSON only.
            `;

    const geminiResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: imageBytes.toString("base64"),
                mimeType,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = geminiResponse.text;

    if (!text) {
      return res.status(502).json({
        error: "Empty response from Gemini",
      });
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Gemini did not return valid JSON",
        raw: text,
      });
    }

    const validated = responseSchema.safeParse(parsedJson);

    if (!validated.success) {
      return res.status(502).json({
        error: "Gemini JSON did not match expected schema",
        details: validated.error.flatten(),
        raw: parsedJson,
      });
    }

    const data = validated.data;

    return res.json({
      ok: true,
      source_id: geminiResponse?.responseId ?? null,
      macros_per_serving: {
        calories_kcal: data.calories_kcal,
        carbs_g: data.carbs_g,
        protein_g: data.protein_g,
        fat_g: data.fat_g,
        serving_size_g: data.serving_size_g,
        serving_size_ml: data.serving_size_ml,
        serving_description: data.serving_description,
      },
      confidence: data.confidence,
    });
  } catch (error: any) {
    console.error("Gemini analysis failed:", error);

    const status = error?.status;
    if (status === 429) {
      const retryInfo = Array.isArray(error?.error?.details)
        ? error.error.details.find((d: any) =>
            d?.["@type"]?.includes("RetryInfo"),
          )
        : null;
      const retryDelay = retryInfo?.retryDelay ?? null;
      return res.status(429).json({
        error: "Gemini API rate limit exceeded",
        retry_after: retryDelay,
      });
    }

    return res.status(500).json({
      error: "Failed to analyze label",
      details: error?.message ?? "Unknown error",
    });
  }
};

export const postFoodLogByAccountIdFromNutritionalLabelScanner = async (
  req: Request,
  res: Response,
) => {
  try {
    const account_id = String(req.body?.account_id ?? "").trim();
    const food_name = String(req.body?.food_name ?? "").trim();
    const meal_type = String(req.body?.meal_type ?? "")
      .trim()
      .toUpperCase();
    const source_id = String(req.body?.source_id ?? "").trim();

    const serving_size_g = Number(req.body?.serving_size_g);
    const serving_size_ml_raw = req.body?.serving_size_ml;
    const serving_size_ml =
      serving_size_ml_raw == null || serving_size_ml_raw === ""
        ? null
        : Number(serving_size_ml_raw);

    const number_of_servings = Number(req.body?.number_of_servings);
    const calories_kcal = Number(req.body?.calories_kcal);
    const carbohydrates_g = Number(req.body?.carbohydrates_g);
    const protein_g = Number(req.body?.protein_g);
    const fat_g = Number(req.body?.fat_g);

    if (!account_id)
      return res.status(400).json({ error: "account_id is required" });
    if (!food_name)
      return res.status(400).json({ error: "food_name is required" });
    if (!source_id)
      return res.status(400).json({ error: "source_id is required" });

    const allowedMeals = new Set(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);
    if (!allowedMeals.has(meal_type)) {
      return res.status(400).json({
        error: "meal_type must be one of BREAKFAST, LUNCH, DINNER, SNACK",
        got: meal_type,
      });
    }

    if (!Number.isFinite(serving_size_g) || serving_size_g <= 0) {
      return res
        .status(400)
        .json({ error: "serving_size_g must be a number > 0" });
    }

    if (serving_size_ml != null) {
      if (!Number.isFinite(serving_size_ml) || serving_size_ml <= 0) {
        return res
          .status(400)
          .json({
            error: "serving_size_ml must be a number > 0 when provided",
          });
      }
    }

    if (!Number.isFinite(number_of_servings) || number_of_servings <= 0) {
      return res
        .status(400)
        .json({ error: "number_of_servings must be a number > 0" });
    }

    if (!Number.isFinite(calories_kcal) || calories_kcal < 0) {
      return res
        .status(400)
        .json({ error: "calories_kcal must be a number >= 0" });
    }
    if (!Number.isFinite(carbohydrates_g) || carbohydrates_g < 0) {
      return res
        .status(400)
        .json({ error: "carbohydrates_g must be a number >= 0" });
    }
    if (!Number.isFinite(protein_g) || protein_g < 0) {
      return res.status(400).json({ error: "protein_g must be a number >= 0" });
    }
    if (!Number.isFinite(fat_g) || fat_g < 0) {
      return res.status(400).json({ error: "fat_g must be a number >= 0" });
    }

    const profile_id = await getProfileIdByAccountId(account_id);
    if (!profile_id) {
      return res
        .status(404)
        .json({ error: "Profile not found for account_id" });
    }

    const inserted = await db
      .insert(foodLogs)
      .values({
        profile_id,
        food_name,
        serving_size_g,
        serving_size_ml,
        number_of_servings: Math.floor(number_of_servings),
        meal_type: meal_type as any,
        calories_kcal: Math.round(calories_kcal),
        carbohydrates_g,
        protein_g,
        fat_g,
        source_type: "GOOGLE_GEMINI_API",
        source_id,
      })
      .returning();

    try {
      await recalculateDailyTotals(profile_id, new Date());
    } catch (recalcError) {
      console.error(
        "Failed to recalculate daily totals after Gemini insert:",
        recalcError,
      );
    }

    return res.status(201).json({
      ok: true,
      food_log: inserted?.[0] ?? null,
    });
  } catch (error: any) {
    console.error("Gemini food log insert failed:", error);
    return res.status(500).json({
      error: "Failed to create food log",
      details: error?.message ?? "Unknown error",
    });
  }
};

export const postFoodLogByAccountIdFromSolidScanner = async (
  req: Request,
  res: Response,
) => {
  try {
    const account_id = String(req.body?.account_id ?? "").trim();
    const food_name = String(req.body?.food_name ?? "").trim();
    const meal_type = String(req.body?.meal_type ?? "")
      .trim()
      .toUpperCase();
    const meal_id = String(req.body?.meal_id ?? "").trim();

    const number_of_servings_raw = req.body?.number_of_servings;
    const number_of_servings =
      number_of_servings_raw == null || number_of_servings_raw === ""
        ? 1
        : Number(number_of_servings_raw);

    const calories_kcal = Number(req.body?.calories_kcal);
    const carbohydrates_g = Number(req.body?.carbohydrates_g);
    const protein_g = Number(req.body?.protein_g);
    const fat_g = Number(req.body?.fat_g);

    if (!account_id)
      return res.status(400).json({ error: "account_id is required" });
    if (!food_name)
      return res.status(400).json({ error: "food_name is required" });
    if (!meal_id) return res.status(400).json({ error: "meal_id is required" });

    const allowedMeals = new Set(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);
    if (!allowedMeals.has(meal_type)) {
      return res.status(400).json({
        error: "meal_type must be one of BREAKFAST, LUNCH, DINNER, SNACK",
        got: meal_type,
      });
    }

    if (!Number.isFinite(number_of_servings) || number_of_servings <= 0) {
      return res
        .status(400)
        .json({ error: "number_of_servings must be a number > 0" });
    }

    if (!Number.isFinite(calories_kcal) || calories_kcal < 0) {
      return res
        .status(400)
        .json({ error: "calories_kcal must be a number >= 0" });
    }
    if (!Number.isFinite(carbohydrates_g) || carbohydrates_g < 0) {
      return res
        .status(400)
        .json({ error: "carbohydrates_g must be a number >= 0" });
    }
    if (!Number.isFinite(protein_g) || protein_g < 0) {
      return res.status(400).json({ error: "protein_g must be a number >= 0" });
    }
    if (!Number.isFinite(fat_g) || fat_g < 0) {
      return res.status(400).json({ error: "fat_g must be a number >= 0" });
    }

    const profile_id = await getProfileIdByAccountId(account_id);
    if (!profile_id) {
      return res
        .status(404)
        .json({ error: "Profile not found for account_id" });
    }

    const inserted = await db
      .insert(foodLogs)
      .values({
        profile_id,
        food_name,
        serving_size_g: 1,
        serving_size_ml: null,
        number_of_servings: Math.floor(number_of_servings),
        meal_type: meal_type as any,
        calories_kcal: Math.round(calories_kcal),
        carbohydrates_g,
        protein_g,
        fat_g,
        source_type: "AWS_API",
        source_id: meal_id,
      })
      .returning();

    try {
      await recalculateDailyTotals(profile_id, new Date());
    } catch (recalcError) {
      console.error(
        "Failed to recalculate daily totals after AWS insert:",
        recalcError,
      );
    }

    return res.status(201).json({
      ok: true,
      food_log: inserted?.[0] ?? null,
    });
  } catch (error: any) {
    console.error("Solid scanner food log insert failed:", error);
    return res.status(500).json({
      error: "Failed to create food log",
      details: error?.message ?? "Unknown error",
    });
  }
};
