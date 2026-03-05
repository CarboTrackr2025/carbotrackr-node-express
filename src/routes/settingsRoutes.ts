import { Router } from "express"
import {
    getAccountSettings,
    getHealthSettings,
    putAccountSettings,
    putHealthSettings
} from "../controller/settingsController.ts";
import { validateParams, validateBody} from "../middleware/validation.ts"
import { z } from "zod"

const router = Router()

const accountSettingsParamsSchema = z.object({
    account_id: z.string().trim().min(1, "Account ID is required")
})

const putAccountSettingsBodySchema = z.object({
    account_id: z.string().trim().min(1, { message: "account_id is required" }),
    date_of_birth: z.string().refine((value) => !isNaN(Date.parse(value)), {
        message: "date_of_birth must be a valid date",
    }),
    gender: z.enum(["MALE", "FEMALE"]),
    height_cm: z.number().positive(),
    weight_kg: z.number().positive(),
})

const putHealthSettingsSchema = z.object({
    account_id: z.string().trim().min(1, { message: "account_id is required" }),
    daily_calorie_goal_kcal: z.number().positive(),
    daily_carbohydrate_goal_g: z.number().positive(),
    reminder_frequency: z.number().int().positive(),
})


router.get("/account/:account_id", validateParams(accountSettingsParamsSchema), getAccountSettings)
router.put("/account/save", validateBody(putAccountSettingsBodySchema), putAccountSettings)

router.get("/health/:account_id", validateParams(accountSettingsParamsSchema), getHealthSettings)
router.put("/health/save", validateBody(putHealthSettingsSchema), putHealthSettings)

export default router