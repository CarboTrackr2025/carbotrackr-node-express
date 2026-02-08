import { Router } from "express"
import { createAccount, listUserIds, loginUser } from "../controller/authController.ts"

const router = Router()

// Create an account (creates Clerk user and DB record)
router.post("/register", createAccount)

// Login (server-side credential exchange)
router.post("/login", loginUser)

// List Clerk user IDs (test; no auth)
router.get("/users", listUserIds)


export default router