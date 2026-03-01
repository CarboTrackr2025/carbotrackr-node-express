import { Router } from "express"
import { getAccountSettings } from "../controller/settingsController.ts";
import { validateParams } from "../middleware/validation.ts"
import { z } from "zod"

const router = Router()

const accountSettingsParamsSchema = z.object({
    accountId: z.string().trim().min(1, "Account ID is required")
})

router.get("/account/:accountId", validateParams(accountSettingsParamsSchema), getAccountSettings)


export default router