import { Router } from "express";
import {
  createAccount,
  listUserIds,
  loginUser,
  refreshToken,
  logout,
  getUserSessions,
  getSessionById,
  deleteAccount,
} from "../controller/authController.ts";

const router = Router();

// Create an account (persist Clerk user in local DB)
router.post("/account", createAccount);

// Login (server-side credential exchange)
router.post("/login", loginUser);

// Refresh session token using sessionId or expired token (decoded to get sid)
router.post("/refresh", refreshToken);

// Logout (revoke session)
router.post("/logout", logout);

// List Clerk user IDs (test; no auth)
router.get("/users", listUserIds);

// DEV debug routes (handlers themselves will check isDev())
router.get("/users/:userId/sessions", getUserSessions);
router.get("/sessions/:sessionId", getSessionById);

// Soft delete account
router.delete("/account/:accountId", deleteAccount);

export default router;
