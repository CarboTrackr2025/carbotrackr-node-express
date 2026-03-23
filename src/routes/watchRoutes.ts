import { Router } from "express";
import { createWatchMetric, getWatchMetrics } from "../controller/watchController.ts";

const watchRoutes = Router();

watchRoutes.post("/setData", createWatchMetric);
watchRoutes.get("/getData", getWatchMetrics);

export default watchRoutes;

