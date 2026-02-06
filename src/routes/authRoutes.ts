import { Router } from "express"
import { createAccount, listUserIds } from "../controller/authController.ts"

const router = Router()

// Create an account (creates Clerk user and DB record)
router.post("/register", createAccount)

// List Clerk user IDs (test; no auth)
router.get("/users", listUserIds)

export default router