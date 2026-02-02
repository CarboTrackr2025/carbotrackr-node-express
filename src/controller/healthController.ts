import type { Request, Response } from "express"
import { db } from "../db/connection.ts"
import {bloodPressureMeasurements, profiles} from "../db/schema.ts"


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
                message: "An error occurred while creating blood pressure measurement"
            })
    }
}