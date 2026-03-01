import type { Request, Response } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db/connection.ts"
import { accounts, profiles } from "../db/schema.ts"

export const getAccountSettings = async (req: Request, res: Response) => {
    try
    {
        const accountId = String(req.params.accountId ?? "").trim()

        if (!accountId)
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
            .where(eq(accounts.id, accountId))
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