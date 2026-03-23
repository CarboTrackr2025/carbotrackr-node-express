import type { Request, Response } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import db from "../db/connection.ts";
import { watchMetrics } from "../db/schema.ts";

const toNonNegativeInteger = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

export const createWatchMetric = async (req: Request, res: Response) => {
  try {
    const { profile_id, heart_rate_bpm, steps_count, calories_burned_kcal, measured_at } =
      req.body ?? {};

    if (!profile_id || typeof profile_id !== "string") {
      return res.status(400).json({
        status: "Error",
        message: "profile_id is required",
        timestamp: new Date().toISOString(),
      });
    }

    const heartRate = toNonNegativeInteger(heart_rate_bpm);
    const steps = toNonNegativeInteger(steps_count);
    const calories = toNonNegativeInteger(calories_burned_kcal);

    if (heartRate === null || steps === null || calories === null) {
      return res.status(400).json({
        status: "Error",
        message:
          "heart_rate_bpm, steps_count, and calories_burned_kcal must be non-negative integers",
        timestamp: new Date().toISOString(),
      });
    }

    const values: typeof watchMetrics.$inferInsert = {
      profile_id,
      heart_rate_bpm: heartRate,
      steps_count: steps,
      calories_burned_kcal: calories,
    };

    if (measured_at !== undefined && measured_at !== null) {
      const parsedDate = new Date(measured_at);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          status: "Error",
          message: "measured_at must be a valid date-time string",
          timestamp: new Date().toISOString(),
        });
      }
      values.measured_at = parsedDate;
    }

    const [created] = await db.insert(watchMetrics).values(values).returning();

    return res.status(201).json({
      status: "Success",
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "Error",
      message: error?.message ?? "Failed to create watch metric",
      timestamp: new Date().toISOString(),
    });
  }
};

export const getWatchMetrics = async (req: Request, res: Response) => {
  try {
    const { profile_id, from, to, limit } = req.query;

    if (!profile_id || typeof profile_id !== "string") {
      return res.status(400).json({
        status: "Error",
        message: "profile_id query parameter is required",
        timestamp: new Date().toISOString(),
      });
    }

    const conditions = [eq(watchMetrics.profile_id, profile_id)];

    if (typeof from === "string") {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({
          status: "Error",
          message: "from must be a valid date-time string",
          timestamp: new Date().toISOString(),
        });
      }
      conditions.push(gte(watchMetrics.measured_at, fromDate));
    }

    if (typeof to === "string") {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({
          status: "Error",
          message: "to must be a valid date-time string",
          timestamp: new Date().toISOString(),
        });
      }
      conditions.push(lte(watchMetrics.measured_at, toDate));
    }

    let parsedLimit = 100;
    if (typeof limit === "string") {
      const maybeLimit = Number(limit);
      if (!Number.isInteger(maybeLimit) || maybeLimit <= 0) {
        return res.status(400).json({
          status: "Error",
          message: "limit must be a positive integer",
          timestamp: new Date().toISOString(),
        });
      }
      parsedLimit = Math.min(maybeLimit, 500);
    }

    const rows = await db
      .select()
      .from(watchMetrics)
      .where(and(...conditions))
      .orderBy(desc(watchMetrics.measured_at))
      .limit(parsedLimit);

    return res.status(200).json({
      status: "Success",
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "Error",
      message: error?.message ?? "Failed to fetch watch metrics",
      timestamp: new Date().toISOString(),
    });
  }
};

