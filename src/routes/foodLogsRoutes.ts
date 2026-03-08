import { Router } from "express"
import {
    getFoodByQuery,
    getFoodDetailsByServingId, getFoodLogsByAccountId,
    postFoodLog,
} from "../controller/foodLogsController.ts";
import getProfileIdByAccountId from "../utils/auth.utils.ts";
import { validateParams, validateQuery, validateBody } from "../middleware/validation.ts";
import { z } from "zod";

const router = Router()

const searchFoodQuerySchema = z.object({
    q: z.string().trim().min(1, { message: "q is required" }),
});

const foodServingParamsSchema = z.object({
    food_id: z.string().trim().min(1, { message: "food_id is required" }),
    serving_id: z.string().trim().min(1, { message: "serving_id is required" }),
});

const createFoodLogSchema = z.object({
    account_id: z.string().trim().min(1, { message: "account_id is required" }),
    food_id: z.string().trim().min(1, { message: "food_id is required" }),
    serving_id: z.string().trim().min(1, { message: "serving_id is required" }),
    meal_type: z
        .string()
        .trim()
        .toUpperCase()
        .pipe(z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"])),
    number_of_servings: z
        .coerce
        .number()
        .positive({ message: "number_of_servings must be > 0" })
        .optional(),
});

const accountIdParamsSchema = z.object({
    account_id: z.string().trim().min(1, { message: "account_id is required" }),
});

const foodLogsReportQuerySchema = z.object({
    start_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "Invalid start_date format",
    }),
    end_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "Invalid end_date format",
    }),
});


router.get("/search", validateQuery(searchFoodQuerySchema), getFoodByQuery);

router.get(
    "/food/:food_id/serving/:serving_id",
    validateParams(foodServingParamsSchema),
    getFoodDetailsByServingId,
);

router.post("/create", validateBody(createFoodLogSchema), postFoodLog);
router.get(
    "/:account_id/",
    validateParams(accountIdParamsSchema),
    validateQuery(foodLogsReportQuerySchema),
    getFoodLogsByAccountId,
);

export default router