import { Router } from "express"
import {getAccountSettings, putAccountSettings} from "../controller/settingsController.ts";
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


router.get("/account/:account_id", validateParams(accountSettingsParamsSchema), getAccountSettings)
router.put("/account/save", validateBody(putAccountSettingsBodySchema), putAccountSettings)

export default router