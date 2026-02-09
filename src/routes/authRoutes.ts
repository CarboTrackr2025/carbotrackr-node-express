import { Router } from "express"
import { createAccount, listUserIds, loginUser, refreshToken } from "../controller/authController.ts"

const router = Router()

// Create an account (creates Clerk user and DB record)
router.post("/register", createAccount)

// Login (server-side credential exchange)
router.post("/login", loginUser)

// Refresh session token using sessionId or expired token (decoded to get sid)
router.post("/refresh", refreshToken)

// List Clerk user IDs (test; no auth)
router.get("/users", listUserIds)


export default router