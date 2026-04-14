import type { Request, Response } from "express";
import { db } from "../db/connection.ts";
import { bloodPressureMeasurements } from "../db/schema.ts";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { bloodGlucoseMeasurements } from "../db/schema.ts";
import { foodLogs } from "../db/schema.ts";
import { carbohydrateData } from "../db/schema.ts";
import { healthMetrics } from "../db/schema.ts";
import { profiles } from "../db/schema.ts";
import getProfileIdByAccountId from "../utils/auth.utils.ts";
import { getDayBoundsInTimeZone } from "../utils/dailyTotalsUtils.ts";

export const createBloodPressure = async (req: Request, res: Response) => {
  try {
    const { account_id, systolic_mmHg, diastolic_mmHg } = req.body;

    if (!account_id) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to create blood pressure measurement",
      });
    }

    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    const result = await db.transaction(async (tx) => {
      const [newBloodPressure] = await tx
        .insert(bloodPressureMeasurements)
        .values({
          profile_id,
          systolic_mmHg,
          diastolic_mmHg,
        })
        .returning();

      return newBloodPressure;
    });

    res.status(201).json({
      status: "success",
      message: "Blood pressure measurement created successfully",
      data: result,
    });
  } catch (e) {
    console.error("Error: CREATE - Blood Pressure Measurement", e);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while creating blood pressure measurement. Please check if the account ID is valid.",
    });
  }
};

export const viewBloodPressureReport = async (req: Request, res: Response) => {
  try {
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;
    const account_id = String(req.params.account_id ?? "").trim();

    if (!account_id) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to create blood pressure measurement",
      });
    }

    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    if (typeof start_date !== "string" || typeof end_date !== "string") {
      return res.status(400).json({
        status: "error",
        message: "start_date and end_date query params are required",
      });
    }

    const parseStart = (raw: string) => {
      if (raw.includes("T")) return new Date(raw);
      return new Date(`${raw}T00:00:00.000Z`);
    };

    const parseEnd = (raw: string) => {
      if (raw.includes("T")) return new Date(raw);
      return new Date(`${raw}T23:59:59.999Z`);
    };

    const start = parseStart(start_date);
    const end = parseEnd(end_date);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        status: "error",
        message: "Invalid date format for start_date or end_date",
      });
    }

    const result = await db
      .select()
      .from(bloodPressureMeasurements)
      .where(
        and(
          eq(bloodPressureMeasurements.profile_id, profile_id as string),
          gte(bloodPressureMeasurements.created_at, start as Date),
          lte(bloodPressureMeasurements.created_at, end as Date),
        ),
      )
      .orderBy(desc(bloodPressureMeasurements.created_at));

    res.status(200).json({
      status: "success",
      message: "Blood pressure report retrieved successfully",
      data: result,
    });
  } catch (e) {
    console.error("Error: GET - Blood Pressure Measurement Report", e);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while retrieving blood pressure measurements. Please check if the account ID is valid.",
    });
  }
};

export const createBloodGlucose = async (req: Request, res: Response) => {
  try {
    const { account_id, level, meal_context } = req.body;

    if (!account_id) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to create blood glucose measurement",
      });
    }

    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    const result = await db.transaction(async (tx) => {
      const [newBloodGlucose] = await tx
        .insert(bloodGlucoseMeasurements)
        .values({
          profile_id,
          level,
          meal_context,
        })
        .returning();

      return newBloodGlucose;
    });

    res.status(201).json({
      status: "success",
      message: "Blood glucose measurement created successfully",
      data: result,
    });
  } catch (e) {
    console.error("Error: CREATE - Blood Glucose Measurement", e);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while creating blood glucose measurement. Please check if the profile ID is valid.",
    });
  }
};

export const viewBloodGlucoseReport = async (req: Request, res: Response) => {
  try {
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;
    const account_id = String(req.params.account_id ?? "").trim();

    if (!account_id) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to view blood glucose report",
      });
    }

    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    if (typeof start_date !== "string" || typeof end_date !== "string") {
      return res.status(400).json({
        status: "error",
        message: "start_date and end_date query params are required",
      });
    }

    const parseStart = (raw: string) => {
      if (raw.includes("T")) return new Date(raw);
      return new Date(`${raw}T00:00:00.000Z`);
    };

    const parseEnd = (raw: string) => {
      if (raw.includes("T")) return new Date(raw);
      return new Date(`${raw}T23:59:59.999Z`);
    };

    const start = parseStart(start_date);
    const end = parseEnd(end_date);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        status: "error",
        message: "Invalid date format for start_date or end_date",
      });
    }

    const result = await db
      .select()
      .from(bloodGlucoseMeasurements)
      .where(
        and(
          eq(bloodGlucoseMeasurements.profile_id, profile_id as string),
          gte(bloodGlucoseMeasurements.created_at, start as Date),
          lte(bloodGlucoseMeasurements.created_at, end as Date),
        ),
      )
      .orderBy(desc(bloodGlucoseMeasurements.created_at));

    res.status(200).json({
      status: "success",
      message: "Blood glucose report retrieved successfully",
      data: result,
    });
  } catch (e) {
    console.error("Error: GET - Blood Glucose Report", e);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while retrieving blood glucose measurements. Please check if the profile ID is valid.",
    });
  }
};

export const viewLatestDiagnosis = async (req: Request, res: Response) => {
  try {
    const rawAccountId = req.params.account_id;

    if (typeof rawAccountId !== "string" || !rawAccountId.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to view diagnosis",
      });
    }

    const account_id = rawAccountId.trim();
    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    const [result] = await db
      .select({
        diagnosed_with: profiles.diagnosed_with,
        created_at: profiles.created_at,
      })
      .from(profiles)
      .where(eq(profiles.id, profile_id))
      .orderBy(desc(profiles.created_at))
      .limit(1);

    if (!result) {
      return res.status(404).json({
        status: "error",
        message: "No diagnosis found for this account",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Latest diagnosis retrieved successfully",
      data: result,
    });
  } catch (e) {
    console.error("Error: GET - Latest Diagnosis", e);
    return res.status(500).json({
      status: "error",
      message:
        "An error occurred while retrieving the latest diagnosis. Please check if the account ID is valid.",
    });
  }
};

export const viewDailyCarbohydrateTotal = async (
  req: Request,
  res: Response,
) => {
  try {
    const account_id = String(req.params.account_id ?? "").trim();
    const date = req.query.date;

    if (!account_id) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to view daily carbohydrate total",
      });
    }

    if (typeof date !== "string") {
      return res.status(400).json({
        status: "error",
        message: "date query param is required",
      });
    }

    const start = date.includes("T")
      ? new Date(date)
      : new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({
        status: "error",
        message: "Invalid date format for date query param",
      });
    }

    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);

    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    const [result] = await db
      .select({
        total_carbohydrates_g: sql<number>`coalesce(sum(${foodLogs.carbohydrates_g}), 0)`,
      })
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.profile_id, profile_id),
          gte(foodLogs.created_at, start),
          lte(foodLogs.created_at, end),
        ),
      );

    return res.status(200).json({
      status: "success",
      message: "Daily carbohydrate total retrieved successfully",
      data: {
        account_id,
        date: start.toISOString().slice(0, 10),
        total_carbohydrates_g: Number(result?.total_carbohydrates_g ?? 0),
      },
    });
  } catch (e) {
    console.error("Error: GET - Daily Carbohydrate Total", e);
    return res.status(500).json({
      status: "error",
      message:
        "An error occurred while retrieving daily carbohydrate total. Please check if the account ID is valid.",
    });
  }
};

export const viewCarbohydrateGoal = async (req: Request, res: Response) => {
  try {
    const account_id = String(req.params.account_id ?? "").trim();
    const date = req.query.date;

    if (!account_id) {
      return res.status(400).json({
        status: "error",
        message: "Account ID is required to view carbohydrate goal",
      });
    }

    if (typeof date !== "undefined" && typeof date !== "string") {
      return res.status(400).json({
        status: "error",
        message: "date query param must be a string",
      });
    }

    const bounds = getDayBoundsInTimeZone(date);

    if (!bounds) {
      return res.status(400).json({
        status: "error",
        message: "Invalid date format for date query param",
      });
    }

    const { start, end, date: normalizedDate } = bounds;

    const profile_id = await getProfileIdByAccountId(account_id);

    if (!profile_id) {
      return res.status(404).json({
        status: "error",
        message: "No profile found for this account",
      });
    }

    const [goalResult, summaryResult, totalResult] = await Promise.all([
      db
        .select({
          daily_carbohydrate_goal_g: healthMetrics.daily_carbohydrate_goal_g,
        })
        .from(healthMetrics)
        .where(eq(healthMetrics.profile_id, profile_id))
        .orderBy(desc(healthMetrics.updated_at))
        .limit(1),
      db
        .select({
          carbohydrate_actual_g: carbohydrateData.carbohydrate_actual_g,
        })
        .from(carbohydrateData)
        .where(
          and(
            eq(carbohydrateData.profile_id, profile_id),
            gte(carbohydrateData.created_at, start),
            lte(carbohydrateData.created_at, end),
          ),
        )
        .orderBy(desc(carbohydrateData.created_at))
        .limit(1),
      db
        .select({
          current_carbohydrates_g: sql<number>`coalesce(sum(${foodLogs.carbohydrates_g}), 0)`,
        })
        .from(foodLogs)
        .where(
          and(
            eq(foodLogs.profile_id, profile_id),
            gte(foodLogs.created_at, start),
            lte(foodLogs.created_at, end),
          ),
        )
        .limit(1),
    ]);

    const goal = goalResult[0];
    const summary = summaryResult[0];
    const total = totalResult[0];
    const summaryCarbs = Number(summary?.carbohydrate_actual_g ?? 0);
    const liveCarbs = Number(total?.current_carbohydrates_g ?? 0);

    if (!goal) {
      return res.status(404).json({
        status: "error",
        message: "Carbohydrate goal not found for this account",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Carbohydrate goal retrieved successfully",
      data: {
        account_id,
        date: normalizedDate,
        daily_carbohydrate_goal_g: Number(goal.daily_carbohydrate_goal_g),
        current_carbohydrates_g: Math.max(summaryCarbs, liveCarbs),
      },
    });
  } catch (e) {
    console.error("Error: GET - Carbohydrate Goal", e);
    return res.status(500).json({
      status: "error",
      message:
        "An error occurred while retrieving carbohydrate goal. Please check if the account ID is valid.",
    });
  }
};
