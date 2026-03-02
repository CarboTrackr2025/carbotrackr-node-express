import type { Request, Response } from "express";
import { db } from "../db/connection.ts";
import { bloodPressureMeasurements } from "../db/schema.ts";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { bloodGlucoseMeasurements } from "../db/schema.ts";

export const createBloodPressure = async (req: Request, res: Response) => {
  try {
    const { profile_id, systolic_mmHg, diastolic_mmHg } = req.body;

    if (!profile_id) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required to create blood pressure measurement",
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
        "An error occurred while creating blood pressure measurement. Please check if the profile ID is valid.",
    });
  }
};

export const viewBloodPressureReport = async (req: Request, res: Response) => {
  try {
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;
    const profile_id = req.params.profile_id;

    if (!profile_id) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required to create blood pressure measurement",
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
        "An error occurred while retrieving blood pressure measurements. Please check if the profile ID is valid.",
    });
  }
};

export const createBloodGlucose = async (req: Request, res: Response) => {
  try {
    const { profile_id, level, units } = req.body;

    if (!profile_id) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required to create blood glucose measurement",
      });
    }

    const result = await db.transaction(async (tx) => {
      const [newBloodGlucose] = await tx
        .insert(bloodGlucoseMeasurements)
        .values({
          profile_id,
          level,
          units,
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
    const profile_id = req.params.profile_id;

    if (!profile_id) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required to view blood glucose report",
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
