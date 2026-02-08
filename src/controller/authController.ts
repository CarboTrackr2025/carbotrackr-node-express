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

        // Try Clerk server-side sign-in. The Clerk SDK can expose different method names across versions; use dynamic access to be resilient.
        let signInResult: any
        try {
            const signInApi = (clerkClient as any).signIn ?? (clerkClient as any).sign_in ?? (clerkClient as any)
            if (typeof signInApi?.create === 'function') {
                // use Clerk SDK signIn.create
                signInResult = await signInApi.create({ identifier: email, password })
            } else if (typeof (clerkClient as any).authenticate === 'function') {
                // fallback: hypothetical authenticate
                signInResult = await (clerkClient as any).authenticate({ identifier: email, password })
            } else {
                // As a final fallback, attempt to call Clerk REST API using fetch if available
                if (typeof fetch !== 'undefined') {
                    // Prefer the parsed env values from env.ts so custom-env/loadEnv is respected
                    const clerkApiKey = env.CLERK_API_KEY ?? env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET
                    if (!clerkApiKey) {
                        return res.status(500).json({ message: 'Server is not configured with Clerk API key' })
                    }
                    const clerkUrl = 'https://api.clerk.com/v1/sign_in'

                    // Try to lookup clerk user id by email first to avoid "user_id must be included" errors
                    let payload: any = { identifier: email, password }
                    try {
                        const usersPage = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 })
                        const first = usersPage?.data?.[0]
                        if (first?.id) {
                            payload = { user_id: first.id, password }
                        } else {
                            return res.status(401).json({ message: 'Invalid email or password' })
                        }
                    } catch (lookupErr: any) {
                        return res.status(500).json({ message: 'Authentication service error', details: isDev() ? String(lookupErr) : undefined })
                    }

                    let resp = await fetch(clerkUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': `Bearer ${clerkApiKey}`,
                        },
                        body: new URLSearchParams(payload).toString(),
                    })
                    let text = await resp.text()
                    // If clerk responds non-OK, attempt targeted retries for known error shapes
                    if (!resp.ok) {
                        let parsed: any = undefined
                        try { parsed = JSON.parse(text) } catch (e) { /* ignore parse errors */ }
                        const saysUserIdMissing = resp.status === 422 && parsed?.errors && Array.isArray(parsed.errors) && parsed.errors.some((e: any) => e?.meta?.param_name === 'user_id' || e?.message?.includes('user_id'))

                        if (saysUserIdMissing) {
                            try {
                                const usersPage2 = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 })
                                const first2 = usersPage2?.data?.[0]
                                if (first2?.id) {
                                    const userIdToUse = first2.id
                                    resp = await fetch(clerkUrl, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded',
                                            'Authorization': `Bearer ${clerkApiKey}`,
                                        },
                                        body: new URLSearchParams({ user_id: userIdToUse, password }).toString(),
                                    })
                                    text = await resp.text()
                                }
                            } catch (lookupErr: any) {
                                console.error('Clerk sign-in: error looking up user by email for retry:', lookupErr)
                            }
                        }

                        // If still not OK, try sessions endpoint fallback (previous behavior)
                        if (!resp.ok) {
                            if (resp.status === 404) {
                                const altUrl = 'https://api.clerk.com/v1/sessions'
                                const sessionsPayload: any = payload?.user_id ? { user_id: payload.user_id, password } : { email_address: email, password }
                                resp = await fetch(altUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'Authorization': `Bearer ${clerkApiKey}`,
                                    },
                                    body: new URLSearchParams(sessionsPayload).toString(),
                                })
                                text = await resp.text()
                            }
                        }

                        if (!resp.ok) {
                            const clientStatus = resp.status >= 400 && resp.status < 600 ? resp.status : 502
                            return res.status(clientStatus).json({ message: 'Authentication failed', upstreamStatus: resp.status, upstreamBody: text })
                        }
                    }
                    try {
                        signInResult = JSON.parse(text)
                    } catch (parseErr) {
                        signInResult = text
                    }
                } else {
                    return res.status(501).json({ message: 'Server-side sign-in is not supported by configured Clerk SDK' })
                }
            }
        } catch (err: any) {
            console.error('Clerk sign-in error:', err)
            const statusCode = err?.status || err?.statusCode || (err?.status === 401 ? 401 : 401)
            return res.status(statusCode).json({ message: err?.message ?? 'Invalid email or password', details: isDev() ? String(err) : undefined })
        }

        // signInResult shape varies between SDK versions. Try to extract useful session/token info in a robust way.
        let userId: string | undefined
        let userEmail: string | undefined
        let sessionId: string | undefined
        let sessionToken: string | undefined
        let expiresAt: string | undefined

        try {
            // Common shapes: { status: 'complete', createdSessionId, createdSession } or REST payload with user/session fields
            if (signInResult) {
                if (signInResult.status === 'complete') {
                    sessionId = signInResult.createdSessionId ?? signInResult.created_session_id ?? sessionId
                    sessionToken = signInResult.createdSessionToken ?? signInResult.created_session_token ?? sessionToken
                    userId = signInResult.createdUserId ?? signInResult.userId ?? signInResult.user?.id
                    userEmail = signInResult.user?.emailAddresses?.[0]?.emailAddress ?? signInResult.user?.email ?? undefined
                    expiresAt = signInResult.expiresAt ?? signInResult.expires_at ?? undefined
                } else if (signInResult.user) {
                    userId = signInResult.user.id ?? userId
                    userEmail = signInResult.user.email ?? userEmail
                } else if (signInResult.id && signInResult.user_id) {
                    // maybe a session object
                    sessionId = signInResult.id
                    userId = signInResult.user_id
                } else if (signInResult.user_id || signInResult.userId) {
                    userId = signInResult.user_id ?? signInResult.userId
                }
            }
        } catch (extractErr: any) {
            console.error('Error extracting sign-in result fields:', extractErr)
        }

        // If we don't have a userId but the email exists in Clerk, try to look up the user
        if (!userId) {
            try {
                const usersPage = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 })
                const first = usersPage?.data?.[0]
                if (first) {
                    userId = first.id
                    userEmail = userEmail ?? first.emailAddresses?.[0]?.emailAddress
                }
            } catch (err) {
                // ignore
            }
        }

        // Persist minimal local account/profile if missing (non-blocking)
        if (userId) {
            try {
                // Ensure account exists
                try {
                    await db.insert(accounts).values({ id: userId, email: userEmail })
                } catch (insertErr: any) {
                    const pgCode = insertErr?.code || insertErr?.pgCode
                    if (pgCode === '23505') {
                        // already exists
                    } else {
                        console.error('Insert account on login error:', insertErr)
                    }
                }
                // Ensure profile exists
                try {
                    await db.insert(profiles).values({ id: userId, account_id: userId } as any)
                } catch (profileErr: any) {
                    // non-fatal
                }
            } catch (dbErr: any) {
                console.error('DB sync error after login:', dbErr)
            }
        }

        // Return session info to client. Preferred: set HttpOnly cookie if we have a sessionToken; otherwise return JSON with sessionId and user info.
        if (sessionToken) {
            // Set cookie named "__session" by default. Adjust attributes as appropriate for your deployment (Secure must be true in production over HTTPS).
            const isSecure = process.env.NODE_ENV === 'production'
            res.cookie('__session', sessionToken, {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                path: '/',
                // If expiresAt was provided, set maxAge
                maxAge: expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : undefined,
            })

            return res.status(200).json({ userId, email: userEmail, message: 'Signed in', method: 'cookie' })
        }

        // If we have a sessionId but no token, return the sessionId and user info
        if (sessionId) {
            return res.status(200).json({ userId, email: userEmail, sessionId, message: 'Signed in', method: 'sessionId' })
        }

        // Fallback: if signInResult contains a token-like field, return it
        if (signInResult?.sessionToken || signInResult?.token) {
            const token = signInResult.sessionToken ?? signInResult.token
            return res.status(200).json({ userId, email: userEmail, token, message: 'Signed in', method: 'token' })
        }

        // If we reach here, authentication succeeded but we couldn't extract tokens — return minimal success
        return res.status(200).json({ userId, email: userEmail, message: 'Signed in (no token returned by Clerk SDK)' })

    } catch (error: any) {
        console.error('loginUser unexpected error:', error)
        return res.status(500).json({ message: error?.message ?? 'Unexpected error', details: isDev() ? String(error) : undefined })
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

