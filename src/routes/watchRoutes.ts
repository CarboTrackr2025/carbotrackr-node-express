import { Router } from "express";
import {
  createWatchMetric,
  getWatchMetrics,
} from "../controller/watchController.ts";

const watchRoutes = Router();

/**
 * POST /watch/metrics
 * Create a new watch metric entry
 * Body: { profile_id: string, heart_rate_bpm: number, steps_count: number, calories_burned_kcal: number, measured_at?: string }
 */
watchRoutes.post("/metrics", createWatchMetric);

/**
 * GET /watch/metrics
 * Get watch metrics for a profile
 * Query: profile_id (required), from (optional), to (optional), limit (optional)
 */
watchRoutes.get("/metrics", getWatchMetrics);

export default watchRoutes;
