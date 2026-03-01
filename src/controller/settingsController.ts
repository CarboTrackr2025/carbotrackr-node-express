import type { Request, Response } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db/connection.ts"
import { accounts, profiles } from "../db/schema.ts"

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

        const result = await db
            .select({
                email: accounts.email,
                gender: profiles.sex,
                date_of_birth: profiles.date_of_birth,
                height_cm: profiles.height_cm,
                weight_kg: profiles.weight_kg
            })
            .from(accounts)
            .innerJoin(profiles, eq(accounts.id, profiles.account_id))
            .where(eq(accounts.id, account_id))
            .limit(1)

        if (result.length == 0) {
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

        const existingProfile = await db
            .select({
                id: profiles.id,
            })
            .from(profiles)
            .where(eq(profiles.account_id, account_id))
            .limit(1)

        if (existingProfile.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Account settings not found",
            })
        }

        const [updatedSettings] = await db
            .update(profiles)
            .set({
                sex: gender,
                date_of_birth: new Date(date_of_birth),
                height_cm,
                weight_kg,
                updated_at: new Date(),
            })
            .where(eq(profiles.account_id, account_id))
            .returning({
                id: profiles.id,
                account_id: profiles.account_id,
                gender: profiles.sex,
                date_of_birth: profiles.date_of_birth,
                height_cm: profiles.height_cm,
                weight_kg: profiles.weight_kg,
            })

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