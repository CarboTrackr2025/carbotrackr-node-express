import type { Request, Response } from "express"
import { clerkClient } from "@clerk/express"
import { db } from "../db/connection.ts"
import { accounts, profiles } from "../db/schema.ts"
import { isDev } from "../../env.ts"
import env from "../../env.ts"

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
                // Cast to any because the profiles table has many NOT NULL columns in the type definitions; we're intentionally inserting a minimal row and letting the DB defaults handle missing fields.
                await db.insert(profiles).values({
                    id: clerkUser.id,
                    account_id: clerkUser.id,
                } as any)
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

// POST /auth/login - server-side sign-in using Clerk and return session info (or set cookie)
export async function loginUser(req: Request, res: Response) {
    try {
        const { email, password } = req.body || {}
        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required" })
        }
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "email is not a valid email address" })
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` })
        }

        // Require a server-side Clerk key to perform server-side sign-in and token exchange
        const clerkApiKey = env.CLERK_API_KEY ?? env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY ?? process.env.CLERK_API_KEY
        if (!clerkApiKey) return res.status(500).json({ message: 'Server is not configured with Clerk API key' })

        // Lookup the Clerk user by email to obtain user_id (prevents the "user_id must be included" 422 error)
        let clerkUser
        try {
            const usersPage = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 })
            clerkUser = usersPage?.data?.[0]
            if (!clerkUser) return res.status(401).json({ message: 'Invalid email or password' })
        } catch (lookupErr: any) {
            console.error('Clerk user lookup error:', lookupErr)
            return res.status(502).json({ message: 'Authentication service error' })
        }

        // Create a session for the user using Clerk REST sessions endpoint
        const sessionsUrl = 'https://api.clerk.com/v1/sessions'
        let resp
        try {
            resp = await fetch(sessionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${clerkApiKey}`,
                },
                body: new URLSearchParams({ user_id: clerkUser.id, password }).toString(),
            })
        } catch (err: any) {
            console.error('Clerk sessions request failed:', err)
            return res.status(502).json({ message: 'Authentication service unreachable' })
        }

        const text = await resp.text()
        if (!resp.ok) {
            return res.status(resp.status >= 400 && resp.status < 600 ? resp.status : 502).json({ message: 'Authentication failed', upstreamStatus: resp.status, upstreamBody: text })
        }

        let json: any
        try { json = JSON.parse(text) } catch (e) { json = text }

        // Clerk may return different shapes; prefer a token (jwt/sessionToken/token) when available for mobile clients
        const token = json?.jwt ?? json?.token ?? json?.sessionToken ?? undefined
        const sessionId = json?.id ?? json?.session_id ?? undefined

        // NOTE: removed automatic local DB insertion on login. Creating or syncing
        // local `accounts` rows should happen at registration time or via an explicit
        // sync/upsert operation. This prevents duplicate-key errors and avoids
        // modifying the DB as a side-effect of authentication.

        if (token) {
            return res.status(200).json({ userId: clerkUser.id, email, token, message: 'Signed in', method: 'token' })
        }

        if (sessionId) {
            return res.status(200).json({ userId: clerkUser.id, email, sessionId, message: 'Signed in', method: 'sessionId' })
        }

        // Fallback: authentication succeeded but no token/session id found
        return res.status(200).json({ userId: clerkUser.id, email, message: 'Signed in' })

    } catch (error: any) {
        console.error('loginUser unexpected error:', error)
        return res.status(500).json({ message: error?.message ?? 'Unexpected error' })
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

// POST /auth/refresh - refresh a session token using sessionId or an expired token
export async function refreshToken(req: Request, res: Response) {
    try {
        // Try body.sessionId first
        let sessionId: string | undefined = req.body?.sessionId

        // If still no sessionId, allow several flexible token inputs:
        // - body.token: can be raw token, or 'Bearer <token>' (with or without angle brackets)
        // - Authorization header: case-insensitive 'Bearer <token>'
        if (!sessionId) {
            let tokenCandidate: string | undefined

            // Accept token in body (token may be 'Bearer <...>' or raw)
            const bodyToken = req.body?.token
            if (typeof bodyToken === 'string' && bodyToken.trim()) {
                tokenCandidate = bodyToken.trim()
            }

            // If no body token, fall back to Authorization header (case-insensitive)
            if (!tokenCandidate) {
                const authHeader = (req.headers.authorization ?? req.headers.Authorization ?? '') as string
                // Match 'Bearer <token>' case-insensitive, allow optional angle brackets
                const m = authHeader.match(/^\s*Bearer\s+<?(.+?)>?\s*$/i)
                if (m) tokenCandidate = m[1]
            }

            // Normalize tokenCandidate: strip surrounding quotes or angle brackets if any
            if (tokenCandidate) {
                tokenCandidate = tokenCandidate.replace(/^\s*["'`]?<?/, '').replace(/>?["'`]?\s*$/, '')
            }

            // If we have a token candidate, try to decode JWT payload to extract sid/session_id
            if (tokenCandidate) {
                try {
                    const parts = tokenCandidate.split('.')
                    if (parts.length >= 2) {
                        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
                        const payloadJson = Buffer.from(b64, 'base64').toString('utf8')
                        const payload = JSON.parse(payloadJson)
                        sessionId = payload?.sid ?? payload?.session_id ?? sessionId
                    }
                } catch (e) {
                    // ignore decode errors
                }
            }
        }

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId must be provided in body or extractable from Authorization token' })
        }

        const clerkApiKey = env.CLERK_API_KEY ?? env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET
        if (!clerkApiKey) return res.status(500).json({ message: 'Server missing Clerk API key' })

        const url = `https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}/tokens`
        try {
            const resp = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${clerkApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
            const text = await resp.text()
            if (!resp.ok) {
                return res.status(resp.status >= 400 && resp.status < 600 ? resp.status : 502).json({ message: 'failed to refresh token', upstreamStatus: resp.status, upstreamBody: text })
            }
            let json: any
            try { json = JSON.parse(text) } catch (e) { json = text }
            const token = json?.jwt ?? json?.token ?? json?.sessionToken ?? undefined
            if (token && typeof token === 'string') {
                return res.status(200).json({ token })
            }
            return res.status(502).json({ message: 'no token returned from auth provider', upstreamBody: json })
        } catch (err: any) {
            return res.status(502).json({ message: 'error contacting auth provider', details: String(err) })
        }
    } catch (err: any) {
        return res.status(500).json({ message: err?.message ?? 'Unexpected error' })
    }
}
