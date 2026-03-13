import type { Request, Response } from "express"
import type { Multer } from "multer"
import { GoogleGenAI } from "@google/genai"
import { z } from "zod"

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
})

const responseSchema = z.object({
    calories_kcal: z.number().min(0).nullable(),
    carbs_g: z.number().min(0).nullable(),
    protein_g: z.number().min(0).nullable(),
    fat_g: z.number().min(0).nullable(),
    serving_size_g: z.number().min(0).nullable(),
    serving_size_ml: z.number().min(0).nullable(),
    serving_description: z.string().nullable(),
    confidence: z.number().min(0).max(1),
})

export const postLabelMacrosOnly = async (
    req: Request & { file?: Express.Multer.File },
    res: Response
) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "Image file is required",
            })
        }

        const imageBytes: Buffer = req.file.buffer
        const mimeType: string = req.file.mimetype || "image/jpeg"

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
            `

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
        })

        const text = geminiResponse.text

        if (!text) {
            return res.status(502).json({
                error: "Empty response from Gemini",
            })
        }

        let parsedJson: unknown

        try {
            parsedJson = JSON.parse(text)
        } catch {
            return res.status(502).json({
                error: "Gemini did not return valid JSON",
                raw: text,
            })
        }

        const validated = responseSchema.safeParse(parsedJson)

        if (!validated.success) {
            return res.status(502).json({
                error: "Gemini JSON did not match expected schema",
                details: validated.error.flatten(),
                raw: parsedJson,
            })
        }

        const data = validated.data

        return res.json({
            ok: true,
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
        })
    } catch (error: any) {
        console.error("Gemini analysis failed:", error)

        return res.status(500).json({
            error: "Failed to analyze label",
            details: error?.message ?? "Unknown error",
        })
    }
}

