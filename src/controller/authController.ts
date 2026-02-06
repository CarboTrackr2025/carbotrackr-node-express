import type { Request, Response } from "express"
import { clerkClient } from "@clerk/express"
import { db } from "../db/connection.ts"
import { accounts, profiles } from "../db/schema.ts"
import { eq } from "drizzle-orm"
import { isDev } from "../../env.ts"

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

// POST /auth/account - create account in Clerk and persist in local DB
export async function createAccount(req: Request, res: Response) {
    try {
        const { email, password, confirmPassword } = req.body || {}
        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ message: "email, password and confirmPassword are required" })
        }
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "email is not a valid email address" })
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` })
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "passwords do not match" })
        }

        // Create user in Clerk
        let clerkUser
        try {
            clerkUser = await clerkClient.users.createUser({
                emailAddress: [email],
                password,
            })
        } catch (err: any) {
            console.error('Clerk createUser error:', err)
            const statusCode = err?.status || err?.statusCode || 422
            const message = err?.message || "Unprocessable Entity"
            const details = err?.errors || err?.response?.data || err?.meta || undefined
            const detailsForClient = isDev() ? (details ?? (typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2) : String(err))) : undefined
            return res.status(statusCode).json({ message, details: detailsForClient })
        }

        // Insert into local DB: use clerkUser.id as accounts.id (string), and create minimal profile with same id
        try {
            // Insert or upsert account row with id = clerkUser.id
            try {
                await db.insert(accounts).values({
                    id: clerkUser.id,
                    email,
                })
            } catch (insertErr: any) {
                // If primary key already exists, ignore; else, rethrow
                console.error('Insert account error:', insertErr)
                const pgCode = insertErr?.code || insertErr?.pgCode
                if (pgCode === '23505') {
                    // unique violation - account already exists, continue
                } else {
                    throw insertErr
                }
            }

            // Create minimal profile using clerkUser.id as profiles.id and account_id
            try {
                await db.insert(profiles).values({
                    id: clerkUser.id,
                    account_id: clerkUser.id,
                })
            } catch (profileInsertErr: any) {
                console.error('Profile insert error (non-fatal):', profileInsertErr)
            }

        } catch (dbErr: any) {
            console.error('DB error when inserting account/profile:', dbErr)
            return res.status(500).json({ message: dbErr?.message ?? 'Database error', details: isDev() ? String(dbErr) : undefined })
        }

        return res.status(201).json({
            id: clerkUser.id,
            email,
        })
    } catch (error: any) {
        console.error('createAccount unexpected error:', error)
        return res.status(500).json({ message: error?.message ?? "Unexpected error" })
    }
}

// GET /auth/users - list Clerk user IDs (no auth; testing only)
export async function listUserIds(_req: Request, res: Response) {
    try {
        const usersPage = await clerkClient.users.getUserList()
        const userIds = usersPage.data.map(u => u.id)
        return res.status(200).json(userIds)
    } catch (error: any) {
        return res.status(500).json({ message: error?.message ?? "Unexpected error" })
    }
}
