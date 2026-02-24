import { Router } from "express"
import { z } from "zod"
import { validateBody, validateParams, validateQuery } from "../middleware/validation.ts"
import {
    createBloodPressure,
    viewBloodPressureReport,
    createHeartRate,
    viewHeartRateReport,
    createSteps,
    viewStepsReport
} from "../controller/healthController.ts";


const healthRouter = Router()


const decimal_precision_5_scale_2_regex = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/
const decimal_precision_5_scale_2 = z
    .string()
    .trim()
    .regex(decimal_precision_5_scale_2_regex, { "message": "Invalid format, must be a decimal with up to 5 digits and 2 decimal places" })
    .transform((val) => Number(val))
    .refine((n) => Number.isFinite(n), { message: "Value must be a finite number" })


const createBloodPressureSchema = z.object({
    profile_id: z.string().min(1, { message: "Profile ID is required" }).max(255, { message: "Profile ID is too long" }),
    systolic_mmHg: z.int().positive(),
    diastolic_mmHg: z.int().positive()
})


const reportBloodPressureQuerySchema = z.object({
    "start_date": z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), { message: "Invalid start date format" }),
    "end_date": z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), { message: "Invalid end date format" })
})


// Heart Rate Validation Schemas (Wear OS Smartwatch)
const createHeartRateSchema = z.object({
    profile_id: z.string().min(1, { message: "Profile ID is required" }).max(255, { message: "Profile ID is too long" }),
    heart_rate_bpm: z.number().int().positive().min(30).max(300, { message: "Heart rate must be between 30 and 300 bpm" })
})


// Steps Validation Schemas (Wear OS Smartwatch)
const createStepsSchema = z.object({
    profile_id: z.string().min(1, { message: "Profile ID is required" }).max(255, { message: "Profile ID is too long" }),
    steps_count: z.number().int().nonnegative({ message: "Steps count must be a non-negative integer" })
})


// Query schema for date range reports (reused for heart rate and steps)
const reportQuerySchema = z.object({
    "start_date": z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), { message: "Invalid start date format" }),
    "end_date": z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), { message: "Invalid end date format" })
})


// Blood Pressure Routes
healthRouter.post("/blood-pressure/create", validateBody(createBloodPressureSchema), createBloodPressure)
healthRouter.get("/:profile_id/blood-pressure/report", validateQuery(reportBloodPressureQuerySchema), viewBloodPressureReport)


// Heart Rate Routes (Wear OS Smartwatch)
healthRouter.post("/heart-rate/create", validateBody(createHeartRateSchema), createHeartRate)
healthRouter.get("/:profile_id/heart-rate/report", validateQuery(reportQuerySchema), viewHeartRateReport)


// Steps Routes (Wear OS Smartwatch)
healthRouter.post("/steps/create", validateBody(createStepsSchema), createSteps)
healthRouter.get("/:profile_id/steps/report", validateQuery(reportQuerySchema), viewStepsReport)


export default healthRouter