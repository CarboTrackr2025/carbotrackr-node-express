import { Router } from "express";
import { z } from "zod";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validation.ts";
import {
  createBloodPressure,
  viewBloodPressureReport,
} from "../controller/healthController.ts";
import {
  createBloodGlucose,
  viewBloodGlucoseReport,
} from "../controller/healthController.ts";

const healthRouter = Router();

const decimal_precision_5_scale_2_regex = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;
const decimal_precision_5_scale_2 = z
  .string()
  .trim()
  .regex(decimal_precision_5_scale_2_regex, {
    message:
      "Invalid format, must be a decimal with up to 5 digits and 2 decimal places",
  })
  .transform((val) => Number(val))
  .refine((n) => Number.isFinite(n), {
    message: "Value must be a finite number",
  });

const createBloodPressureSchema = z.object({
  account_id: z.string(),
  systolic_mmHg: z.int().positive(),
  diastolic_mmHg: z.int().positive(),
});

const reportBloodPressureQuerySchema = z.object({
  start_date: z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), {
    message: "Invalid start date format",
  }),
  end_date: z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), {
    message: "Invalid end date format",
  }),
});

const createBloodGlucoseSchema = z.object({
  account_id: z.string(),
  level: z
    .string()
    .regex(decimal_precision_5_scale_2_regex)
    .transform((val) => Number(val))
    .refine((n) => n > 0, { message: "Level must be greater than 0" }),
});

const reportBloodGlucoseQuerySchema = z.object({
  start_date: z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), {
    message: "Invalid start date format",
  }),
  end_date: z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), {
    message: "Invalid end date format",
  }),
});

healthRouter.post(
  "/blood-pressure/create",
  validateBody(createBloodPressureSchema),
  createBloodPressure,
);
healthRouter.get(
  "/:account_id/blood-pressure/report",
  validateQuery(reportBloodPressureQuerySchema),
  viewBloodPressureReport,
);

healthRouter.post(
  "/blood-glucose/create",
  validateBody(createBloodGlucoseSchema),
  createBloodGlucose,
);
healthRouter.get(
  "/:account_id/blood-glucose/report",
  validateQuery(reportBloodGlucoseQuerySchema),
  viewBloodGlucoseReport,
);

export default healthRouter;
