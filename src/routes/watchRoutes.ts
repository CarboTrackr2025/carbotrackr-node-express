import { Router } from "express";
import {
  createWatchMetric,
  getWatchMetrics,
} from "../controller/watchController.ts";

const watchRoutes = Router();

/**
 * Debug: GET /watch/ -> list available watch endpoints
 */
watchRoutes.get("/", (req, res) => {
  res.status(200).json({
    status: "Success",
    endpoints: [
      "GET /watch/metrics",
      "POST /watch/metrics",
      "GET /watch/metrics",
      "POST /watch/setData",
      "GET /watch/getData",
    ],
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /watch/metrics (legacy)
 * Create a new watch metric entry
 * Body: { profile_id: string, heart_rate_bpm: number, steps_count: number, calories_burned_kcal: number, measured_at?: string }
 */
watchRoutes.post("/metrics", createWatchMetric);

/**
 * GET /watch/metrics (legacy)
 */
watchRoutes.get("/metrics", getWatchMetrics);

/**
 * Compatibility endpoints expected by the mobile client
 * POST /watch/setData
 * GET  /watch/getData
 */
watchRoutes.post("/setData", createWatchMetric);
watchRoutes.get("/getData", getWatchMetrics);

export default watchRoutes;
