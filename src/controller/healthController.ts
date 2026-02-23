import type { Request, Response } from "express"
import { db } from "../db/connection.ts"
import { bloodPressureMeasurements, heartRateMeasurements, stepsMeasurements } from "../db/schema.ts"
import { and, eq, gte, lte, desc } from "drizzle-orm"


export const createBloodPressure = async (req: Request, res: Response) => {
    try
    {
        const { profile_id, systolic_mmHg, diastolic_mmHg } = req.body

        if (!profile_id)
        {
            return res
                .status(400)
                .json({
                status: "error",
                message: "Profile ID is required to create blood pressure measurement"
            })
        }

        const result = await db.transaction(async (tx) => {
            const [newBloodPressure] = await tx
                .insert(bloodPressureMeasurements)
                .values({
                    profile_id,
                    systolic_mmHg,
                    diastolic_mmHg
                })
                .returning()

            return newBloodPressure
        })

        res.status(201)
            .json({
                status: "success",
                message: "Blood pressure measurement created successfully",
                data: result
            })

    }
    catch(e)
    {
        console.error("Error: CREATE - Blood Pressure Measurement", e)
        res.status(500)
            .json({
                status: "error",
                message: "An error occurred while creating blood pressure measurement. Please check if the profile ID is valid."
            })
    }
}


export const viewBloodPressureReport = async (req: Request, res: Response) => {
    try
    {
        const start_date = req.query.start_date
        const end_date = req.query.end_date
        const profile_id = req.params.profile_id

        if (!profile_id)
        {
            return res
                .status(400)
                .json({
                    status: "error",
                    message: "Profile ID is required to create blood pressure measurement"
                })
        }

        if (typeof start_date !== "string" || typeof end_date !== "string") {
            return res.status(400).json({
                status: "error",
                message: "start_date and end_date query params are required",
            })
        }


        const parseStart = (raw: string) => {
            if (raw.includes("T")) return new Date(raw);
            return new Date(`${raw}T00:00:00.000Z`);
        };

        const parseEnd = (raw: string) => {
            if (raw.includes("T")) return new Date(raw);
            return new Date(`${raw}T23:59:59.999Z`);
        };

        const start = parseStart(start_date);
        const end = parseEnd(end_date);


        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                status: "error",
                message: "Invalid date format for start_date or end_date",
            })
        }


        const result = await db
            .select()
            .from(bloodPressureMeasurements)
            .where(
                and(
                    eq(bloodPressureMeasurements.profile_id, profile_id as string),
                    gte(bloodPressureMeasurements.created_at, start as Date),
                    lte(bloodPressureMeasurements.created_at, end as Date),
                )
            )
            .orderBy(desc(bloodPressureMeasurements.created_at))

        res.status(200)
            .json({
                status: "success",
                message: "Blood pressure report retrieved successfully",
                data: result
            })
    }
    catch(e)
    {
        console.error("Error: GET - Blood Pressure Measurement Report", e)
        res.status(500)
            .json({
                status: "error",
                message: "An error occurred while retrieving blood pressure measurements. Please check if the profile ID is valid."
            })
    }
}


// ============================================
// HEART RATE ENDPOINTS (Wear OS Smartwatch)
// ============================================

/**
 * Create a new heart rate measurement from smartwatch
 * Expected body: { profile_id: string, heart_rate_bpm: number }
 */
export const createHeartRate = async (req: Request, res: Response) => {
    try
    {
        const { profile_id, heart_rate_bpm } = req.body

        // Validate that profile_id exists
        if (!profile_id)
        {
            return res
                .status(400)
                .json({
                    status: "error",
                    message: "Profile ID is required to create heart rate measurement"
                })
        }

        // Insert the heart rate measurement into the database
        const result = await db.transaction(async (tx) => {
            const [newHeartRate] = await tx
                .insert(heartRateMeasurements)
                .values({
                    profile_id,
                    heart_rate_bpm
                })
                .returning()

            return newHeartRate
        })

        // Return success response with the created measurement
        res.status(201)
            .json({
                status: "success",
                message: "Heart rate measurement created successfully",
                data: result
            })
    }
    catch(e)
    {
        console.error("Error: CREATE - Heart Rate Measurement", e)
        res.status(500)
            .json({
                status: "error",
                message: "An error occurred while creating heart rate measurement. Please check if the profile ID is valid."
            })
    }
}


/**
 * Get heart rate measurements for a profile within a date range
 * URL params: profile_id
 * Query params: start_date, end_date (format: YYYY-MM-DD or ISO string)
 */
export const viewHeartRateReport = async (req: Request, res: Response) => {
    try
    {
        const start_date = req.query.start_date
        const end_date = req.query.end_date
        const profile_id = req.params.profile_id

        // Validate profile_id
        if (!profile_id)
        {
            return res
                .status(400)
                .json({
                    status: "error",
                    message: "Profile ID is required to retrieve heart rate measurements"
                })
        }

        // Validate date parameters
        if (typeof start_date !== "string" || typeof end_date !== "string") {
            return res.status(400).json({
                status: "error",
                message: "start_date and end_date query params are required",
            })
        }

        // Parse dates - if no time is provided, assume start of day for start_date and end of day for end_date
        const parseStart = (raw: string) => {
            if (raw.includes("T")) return new Date(raw);
            return new Date(`${raw}T00:00:00.000Z`);
        };

        const parseEnd = (raw: string) => {
            if (raw.includes("T")) return new Date(raw);
            return new Date(`${raw}T23:59:59.999Z`);
        };

        const start = parseStart(start_date);
        const end = parseEnd(end_date);

        // Validate that dates are valid
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                status: "error",
                message: "Invalid date format for start_date or end_date",
            })
        }

        // Query database for heart rate measurements within date range
        const result = await db
            .select()
            .from(heartRateMeasurements)
            .where(
                and(
                    eq(heartRateMeasurements.profile_id, profile_id as string),
                    gte(heartRateMeasurements.created_at, start as Date),
                    lte(heartRateMeasurements.created_at, end as Date),
                )
            )
            .orderBy(desc(heartRateMeasurements.created_at))

        // Return the heart rate data
        res.status(200)
            .json({
                status: "success",
                message: "Heart rate report retrieved successfully",
                data: result
            })
    }
    catch(e)
    {
        console.error("Error: GET - Heart Rate Report", e)
        res.status(500)
            .json({
                status: "error",
                message: "An error occurred while retrieving heart rate measurements. Please check if the profile ID is valid."
            })
    }
}


// ============================================
// STEPS ENDPOINTS (Wear OS Smartwatch)
// ============================================

/**
 * Create a new steps measurement from smartwatch
 * Expected body: { profile_id: string, steps_count: number }
 */
export const createSteps = async (req: Request, res: Response) => {
    try
    {
        const { profile_id, steps_count } = req.body

        // Validate that profile_id exists
        if (!profile_id)
        {
            return res
                .status(400)
                .json({
                    status: "error",
                    message: "Profile ID is required to create steps measurement"
                })
        }

        // Insert the steps measurement into the database
        const result = await db.transaction(async (tx) => {
            const [newSteps] = await tx
                .insert(stepsMeasurements)
                .values({
                    profile_id,
                    steps_count
                })
                .returning()

            return newSteps
        })

        // Return success response with the created measurement
        res.status(201)
            .json({
                status: "success",
                message: "Steps measurement created successfully",
                data: result
            })
    }
    catch(e)
    {
        console.error("Error: CREATE - Steps Measurement", e)
        res.status(500)
            .json({
                status: "error",
                message: "An error occurred while creating steps measurement. Please check if the profile ID is valid."
            })
    }
}


/**
 * Get steps measurements for a profile within a date range
 * URL params: profile_id
 * Query params: start_date, end_date (format: YYYY-MM-DD or ISO string)
 */
export const viewStepsReport = async (req: Request, res: Response) => {
    try
    {
        const start_date = req.query.start_date
        const end_date = req.query.end_date
        const profile_id = req.params.profile_id

        // Validate profile_id
        if (!profile_id)
        {
            return res
                .status(400)
                .json({
                    status: "error",
                    message: "Profile ID is required to retrieve steps measurements"
                })
        }

        // Validate date parameters
        if (typeof start_date !== "string" || typeof end_date !== "string") {
            return res.status(400).json({
                status: "error",
                message: "start_date and end_date query params are required",
            })
        }

        // Parse dates - if no time is provided, assume start of day for start_date and end of day for end_date
        const parseStart = (raw: string) => {
            if (raw.includes("T")) return new Date(raw);
            return new Date(`${raw}T00:00:00.000Z`);
        };

        const parseEnd = (raw: string) => {
            if (raw.includes("T")) return new Date(raw);
            return new Date(`${raw}T23:59:59.999Z`);
        };

        const start = parseStart(start_date);
        const end = parseEnd(end_date);

        // Validate that dates are valid
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                status: "error",
                message: "Invalid date format for start_date or end_date",
            })
        }

        // Query database for steps measurements within date range
        const result = await db
            .select()
            .from(stepsMeasurements)
            .where(
                and(
                    eq(stepsMeasurements.profile_id, profile_id as string),
                    gte(stepsMeasurements.created_at, start as Date),
                    lte(stepsMeasurements.created_at, end as Date),
                )
            )
            .orderBy(desc(stepsMeasurements.created_at))

        // Return the steps data
        res.status(200)
            .json({
                status: "success",
                message: "Steps report retrieved successfully",
                data: result
            })
    }
    catch(e)
    {
        console.error("Error: GET - Steps Report", e)
        res.status(500)
            .json({
                status: "error",
                message: "An error occurred while retrieving steps measurements. Please check if the profile ID is valid."
            })
    }
}
