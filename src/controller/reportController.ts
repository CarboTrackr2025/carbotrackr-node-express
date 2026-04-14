import type { Request, Response } from "express";
import { db } from "../db/connection.ts";
import {
  calorieData,
  carbohydrateData,
  profiles,
  accounts,
} from "../db/schema.ts";
import { eq, and, gte, lte } from "drizzle-orm";

// ── Helper: get profile_id from account_id ───────────────────────────────────
async function getProfileId(accountId: string): Promise<string | null> {
  const result = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.account_id, accountId))
    .limit(1);

  return result[0]?.id ?? null;
}

// ── GET /report/calories?accountId=&startDate=&endDate= ──────────────────────
export async function getCalorieReport(req: Request, res: Response) {
  try {
    const { accountId, startDate, endDate } = req.query;

    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({
        message: "accountId, startDate, and endDate are required",
      });
    }

    const profileId = await getProfileId(String(accountId));
    if (!profileId) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Set end to end of day
    end.setHours(23, 59, 59, 999);

    const data = await db
      .select()
      .from(calorieData)
      .where(
        and(
          eq(calorieData.profile_id, profileId),
          gte(calorieData.created_at, start),
          lte(calorieData.created_at, end),
        ),
      )
      .orderBy(calorieData.created_at);

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error("getCalorieReport error:", error);
    return res
      .status(500)
      .json({ message: error?.message ?? "Unexpected error" });
  }
}

// ── GET /report/carbohydrates?accountId=&startDate=&endDate= ─────────────────
export async function getCarbohydrateReport(req: Request, res: Response) {
  try {
    const { accountId, startDate, endDate } = req.query;

    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({
        message: "accountId, startDate, and endDate are required",
      });
    }

    const profileId = await getProfileId(String(accountId));
    if (!profileId) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    end.setHours(23, 59, 59, 999);

    const data = await db
      .select()
      .from(carbohydrateData)
      .where(
        and(
          eq(carbohydrateData.profile_id, profileId),
          gte(carbohydrateData.created_at, start),
          lte(carbohydrateData.created_at, end),
        ),
      )
      .orderBy(carbohydrateData.created_at);

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error("getCarbohydrateReport error:", error);
    return res
      .status(500)
      .json({ message: error?.message ?? "Unexpected error" });
  }
}
