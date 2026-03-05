import type { Request, Response } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db/connection.ts"
import { accounts, profiles, healthMetrics } from "../db/schema.ts"
import getProfileIdByAccountId from "../utils/auth.utils.ts";

export const getAccountSettings = async (req: Request, res: Response) => {
    try
    {
        const account_id = String(req.params.account_id ?? "").trim()

        if (!account_id)
        {
            return res.status(400).json({
                status: "error",
                message: "Account ID is required"
            })
        }

        const profile_id = await getProfileIdByAccountId(account_id)

        const result = await db
            .select({
                email: accounts.email,
                gender: profiles.sex,
                date_of_birth: profiles.date_of_birth,
                height_cm: profiles.height_cm,
                weight_kg: profiles.weight_kg
            })
            .from(profiles)
            .innerJoin(accounts, eq(accounts.id, profiles.account_id))
            .where(eq(profiles.id, profile_id))
            .limit(1)

        if (result.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Account Settings Not Found"
            })
        }

        return res.status(200).json({
            status: "success",
            message: "Account settings retrieved successfully",
            data: result[0]
        })
    }
    catch (e)
    {
        console.error("Error: GET - Account Settings", e)
        return res.status(404).json({
            status: "error",
            message: "An error occurred while retrieving account settings. Please check if the account ID is valid."
        })
    }
}

export const putAccountSettings = async (req: Request, res: Response) => {
    try {
        const { account_id, gender, date_of_birth, height_cm, weight_kg } = req.body

        if (!account_id) {
            return res.status(400).json({
                status: "error",
                message: "Account ID is required",
            })
        }

        const profile_id = await getProfileIdByAccountId(String(account_id).trim())

        const [updatedSettings] = await db
            .update(profiles)
            .set({
                sex: gender,
                date_of_birth: new Date(date_of_birth),
                height_cm,
                weight_kg,
                updated_at: new Date(),
            })
            .where(eq(profiles.id, profile_id))
            .returning({
                account_id: profiles.account_id,
                gender: profiles.sex,
                date_of_birth: profiles.date_of_birth,
                height_cm: profiles.height_cm,
                weight_kg: profiles.weight_kg,
            })

        if (!updatedSettings) {
            return res.status(404).json({
                status: "error",
                message: "Account settings not found",
            })
        }

        return res.status(200).json({
            status: "success",
            message: "Account settings updated successfully",
            data: updatedSettings,
        })
    } catch (e) {
        console.error("Error: PUT - Account Settings", e)
        return res.status(500).json({
            status: "error",
            message: "An error occurred while updating account settings.",
        })
    }
}

export const getHealthSettings = async (req: Request, res: Response) => {
    try
    {
        const account_id = String(req.params.account_id ?? "").trim()

        if (!account_id) {
            return res.status(400).json({
                status: "error",
                message: "Account ID is required"
            })
        }

        const profile_id = await getProfileIdByAccountId(account_id)

        const result = await db
            .select({
                daily_calorie_goal_kcal: healthMetrics.daily_calorie_goal_kcal,
                daily_carbohydrate_goal_g: healthMetrics.daily_carbohydrate_goal_g,
                reminder_frequency: healthMetrics.reminder_frequency,
                blood_glucose_unit: healthMetrics.blood_glucose_unit,
                diagnosed_with: profiles.diagnosed_with,
            })
            .from(healthMetrics)
            .innerJoin(profiles, eq(healthMetrics.profile_id, profiles.id))
            .where(eq(healthMetrics.profile_id, profile_id))
            .limit(1)

        if (result.length == 0) {
            return res.status(404).json({
                status: "error",
                message: "Health settings not found for the given account ID"
            })
        }

        return res.status(200).json({
            status: "success",
            message: "Health settings retrieved successfully",
            data: result[0]
        })
    }
    catch (e)
    {
        console.error("Error: GET - Health Settings", e)
        return res.status(404).json({
            status: "error",
            message: "An error occurred while retrieving health settings. Please check if the account ID is valid."
        })
    }
}

export const putHealthSettings = async (req: Request, res: Response) => {

    try
    {
        const { account_id, daily_calorie_goal_kcal, daily_carbohydrate_goal_g, reminder_frequency, diagnosed_with } = req.body

        if (!account_id) {
            return res.status(400).json({
                status: "error",
                message: "Account ID is required"
            })
        }

        const profile_id = await getProfileIdByAccountId(account_id)

        const [updatedHealthSettings] = await db
            .update(healthMetrics)
            .set({
                daily_calorie_goal_kcal,
                daily_carbohydrate_goal_g,
                reminder_frequency,
                updated_at: new Date(),
            })
            .where(eq(healthMetrics.profile_id, profile_id))
            .returning({
                daily_calorie_goal_kcal: healthMetrics.daily_calorie_goal_kcal,
                daily_carbohydrate_goal_g: healthMetrics.daily_carbohydrate_goal_g,
                reminder_frequency: healthMetrics.reminder_frequency,
                blood_glucose_unit: healthMetrics.blood_glucose_unit,
            })

        if (!updatedHealthSettings) {
            return res.status(404).json({
                status: "error",
                message: "Health settings not found for the given account ID",
            })
        }

        const [updatedProfile] = await db
            .update(profiles)
            .set({
                diagnosed_with,
                updated_at: new Date(),
            })
            .where(eq(profiles.id, profile_id))
            .returning({
                diagnosed_with: profiles.diagnosed_with,
            })

        return res.status(200).json({
            status: "success",
            message: "Health settings updated successfully",
            data: {
                ...updatedHealthSettings,
                diagnosed_with: updatedProfile?.diagnosed_with,
            },
        })

    }
    catch(e)
    {
        console.log("Error: PUT - Health Settings", e)
        return res.status(500).json({
            status: "error",
            message: "An error occurred while updating health settings.",
        })
    }
}
