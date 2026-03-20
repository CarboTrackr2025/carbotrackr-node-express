import type { Request, Response } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db/connection.ts"
import { accounts, profiles, healthMetrics } from "../db/schema.ts"
import getProfileIdByAccountId from "../utils/auth.utils.ts";

const normalizeReminderTime = (value: unknown): string | null => {
    if (typeof value === "string") {
        const trimmed = value.trim()

        if (!trimmed) return null

        const timeMatch = trimmed.match(
            /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/,
        )
        if (timeMatch) {
            return trimmed.length === 5 ? `${trimmed}:00` : trimmed
        }

        const isoMatch = trimmed.match(
            /^\d{4}-\d{2}-\d{2}[T\s](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$/,
        )
        if (isoMatch?.[1]) return isoMatch[1]
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const hh = String(value.getHours()).padStart(2, "0")
        const mm = String(value.getMinutes()).padStart(2, "0")
        const ss = String(value.getSeconds()).padStart(2, "0")
        return `${hh}:${mm}:${ss}`
    }

    return null
}

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
                reminder_time: healthMetrics.reminder_time,
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
    try {
        const {
            account_id,
            daily_calorie_goal_kcal,
            daily_carbohydrate_goal_g,
            reminder_frequency,
            reminder_time,
            diagnosed_with,
        } = req.body

        console.log("diagnosed_with raw:", JSON.stringify(req.body.diagnosed_with))

        if (!account_id) {
            return res.status(400).json({
                status: "error",
                message: "Account ID is required",
            })
        }

        const allowedDiagnosedWith = new Set([
            "TYPE_2_DIABETES",
            "PRE_DIABETES",
            "NOT_APPLICABLE",
        ])

        const normalizedReminderTime = normalizeReminderTime(reminder_time)
        if (!normalizedReminderTime) {
            return res.status(400).json({
                status: "error",
                message:
                    "reminder_time must be in HH:MM, HH:MM:SS, or HH:MM:SS.sss format",
            })
        }

        if (!diagnosed_with || !allowedDiagnosedWith.has(String(diagnosed_with))) {
            return res.status(400).json({
                status: "error",
                message:
                    "diagnosed_with must be one of TYPE_2_DIABETES, PRE_DIABETES, NOT_APPLICABLE",
            })
        }

        const profile_id = await getProfileIdByAccountId(String(account_id).trim())

        const data = await db.transaction(async (tx) => {
            const [updatedHealthSettings] = await tx
                .update(healthMetrics)
                .set({
                    daily_calorie_goal_kcal: Number(daily_calorie_goal_kcal),
                    daily_carbohydrate_goal_g: Number(daily_carbohydrate_goal_g),
                    reminder_frequency: Number(reminder_frequency),
                    reminder_time: normalizedReminderTime,
                    updated_at: new Date(),
                })
                .where(eq(healthMetrics.profile_id, profile_id))
                .returning({
                    daily_calorie_goal_kcal: healthMetrics.daily_calorie_goal_kcal,
                    daily_carbohydrate_goal_g: healthMetrics.daily_carbohydrate_goal_g,
                    reminder_frequency: healthMetrics.reminder_frequency,
                    reminder_time: healthMetrics.reminder_time,
                })

            if (!updatedHealthSettings) return null

            const [updatedProfile] = await tx
                .update(profiles)
                .set({
                    diagnosed_with: diagnosed_with as "TYPE_2_DIABETES" | "PRE_DIABETES" | "NOT_APPLICABLE",
                    updated_at: new Date(),
                })
                .where(eq(profiles.id, profile_id))
                .returning({
                    diagnosed_with: profiles.diagnosed_with,
                })

            return {
                ...updatedHealthSettings,
                diagnosed_with: updatedProfile?.diagnosed_with,
            }
        })

        if (!data) {
            return res.status(404).json({
                status: "error",
                message: "Health settings not found for the given account ID",
            })
        }

        return res.status(200).json({
            status: "success",
            message: "Health settings updated successfully",
            data,
        })
    } catch (e) {
        console.error("Error: PUT - Health Settings", e)
        return res.status(500).json({
            status: "error",
            message: "An error occurred while updating health settings.",
        })
    }
}
