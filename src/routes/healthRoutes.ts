import { Router } from "express"
import { z } from "zod"
import { validateBody, validateParams, validateQuery } from "../middleware/validation.ts"
import { createBloodPressure} from "../controller/healthController.ts";

const router = Router()

const decimal_precision_5_scale_2_regex = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/
const decimal_precision_5_scale_2 = z
    .string()
    .trim()
    .regex(decimal_precision_5_scale_2_regex, { "message": "Invalid format, must be a decimal with up to 5 digits and 2 decimal places" })
    .transform((val) => Number(val))
    .refine((n) => Number.isFinite(n), { message: "Value must be a finite number" })

const createBloodPressureSchema = z.object({
    profile_id: z.uuid().optional(),
    systolic_mmHg: z.int().positive(),
    diastolic_mmHg: z.int().positive()
})

router.post("/blood-pressure/create", validateBody(createBloodPressureSchema), createBloodPressure)



export default router