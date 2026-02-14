import { Router } from "express"
import { createAccount, listUserIds, loginUser, refreshToken, logout, getUserSessions, getSessionById, updateProfile, createProfile } from "../controller/authController.ts"

const router = Router()

// Create an account (creates Clerk user and DB record)
router.post("/register", createAccount)

// Create profile separately
router.post('/profile', createProfile)

// Login (server-side credential exchange)
router.post("/login", loginUser)

// Refresh session token using sessionId or expired token (decoded to get sid)
router.post("/refresh", refreshToken)

// Logout (revoke session)
router.post("/logout", logout)

// List Clerk user IDs (test; no auth)
router.get("/users", listUserIds)

// DEV debug routes (handlers themselves will check isDev())
router.get('/users/:userId/sessions', getUserSessions)
router.get('/sessions/:sessionId', getSessionById)

// Update profile by account id
router.put('/profile/:accountId', updateProfile)

export default router