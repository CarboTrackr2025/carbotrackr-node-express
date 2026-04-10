import type { Request, Response } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import db from "../db/connection.ts";
import { watchMetrics, profiles } from "../db/schema.ts";

const toPositiveInteger = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

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

// Helper to validate UUID v4-ish format
const isValidUuid = (id: string | null | undefined) => {
  if (!id || typeof id !== "string") return false;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(id);
};

// Helper: create a JS Date that represents the wall-clock time in the given IANA timezone.
// This returns a Date whose UTC instant corresponds to the provided timezone's local date/time.
function dateForZone(
  dt?: Date | number | string | null,
  timeZone = "Asia/Singapore",
) {
  const base = dt ? new Date(dt) : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(base)
    .reduce(
      (acc: any, part) => {
        if (part.type !== "literal") acc[part.type] = part.value;
        return acc;
      },
      {} as Record<string, string>,
    );

  const year = Number(parts.year);
  const month = Number(parts.month); // 1-based
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  // Construct a UTC timestamp that has the same wall-clock components in the target timezone
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utcMs);
}

export const createWatchMetric = async (req: Request, res: Response) => {
  try {
    // Accept either profile_id (internal UUID) or account_id (external auth id)
    const {
      profile_id,
      account_id,
      heart_rate_bpm,
      steps_count,
      calories_burned_kcal,
      measured_at,
    } = req.body ?? {};

    // Log incoming payload for easier debugging (may remove in production)
    console.debug("createWatchMetric payload:", {
      profile_id,
      account_id,
      heart_rate_bpm,
      steps_count,
      calories_burned_kcal,
      measured_at,
    });

    if (
      (!profile_id || typeof profile_id !== "string") &&
      (!account_id || typeof account_id !== "string")
    ) {
      return res.status(400).json({
        status: "Error",
        message:
          "Either profile_id (internal) or account_id (external) is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Resolve to internal profile UUID. Prefer explicit account_id if provided.
    let internalProfileId: string | null = null;

    if (account_id && typeof account_id === "string") {
      const byAccount = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.account_id, account_id))
        .limit(1);
      if (byAccount && byAccount.length > 0)
        internalProfileId = byAccount[0].id;
    }

    // If no account_id match, try using profile_id as account_id first then as internal id
    if (!internalProfileId && profile_id && typeof profile_id === "string") {
      const byAccount = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.account_id, profile_id))
        .limit(1);
      if (byAccount && byAccount.length > 0)
        internalProfileId = byAccount[0].id;
      else {
        const byId = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.id, profile_id))
          .limit(1);
        if (byId && byId.length > 0) internalProfileId = byId[0].id;
      }
    }

    // After resolving internalProfileId
    if (!internalProfileId) {
      return res.status(404).json({
        status: "Error",
        message: "Profile not found for provided profile_id/account_id",
        timestamp: new Date().toISOString(),
      });
    }

    // Validate that resolved id is a proper UUID before inserting to uuid column
    if (!isValidUuid(internalProfileId)) {
      console.error(
        "Resolved profile id is not a valid UUID:",
        internalProfileId,
      );
      return res.status(400).json({
        status: "Error",
        message: "Resolved internal profile id is not a valid UUID",
        resolved: internalProfileId,
        timestamp: new Date().toISOString(),
      });
    }

    const heartRate = toPositiveInteger(heart_rate_bpm);
    const steps = toNonNegativeInteger(steps_count);
    const calories = toNonNegativeInteger(calories_burned_kcal);

    if (heartRate === null) {
      return res.status(400).json({
        status: "Error",
        message: "heart_rate_bpm must be a positive integer (> 0)",
        timestamp: new Date().toISOString(),
      });
    }

    if (steps === null) {
      return res.status(400).json({
        status: "Error",
        message: "steps_count must be a non-negative integer (>= 0)",
        timestamp: new Date().toISOString(),
      });
    }

    if (calories === null) {
      return res.status(400).json({
        status: "Error",
        message: "calories_burned_kcal must be a non-negative integer (>= 0)",
        timestamp: new Date().toISOString(),
      });
    }

    if (heartRate >= 300) {
      return res.status(400).json({
        status: "Error",
        message: "heart_rate_bpm must be less than 300",
        timestamp: new Date().toISOString(),
      });
    }

    const values: typeof watchMetrics.$inferInsert = {
      profile_id: internalProfileId,
      heart_rate_bpm: heartRate,
      steps_count: steps,
      calories_burned_kcal: calories,
      // store measured_at and created_at as Date objects adjusted to Asia/Singapore (GMT+8)
      measured_at: dateForZone(undefined, "Asia/Singapore"),
      created_at: dateForZone(undefined, "Asia/Singapore"),
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
      // Normalize the provided measured_at into a Date adjusted to Asia/Singapore
      values.measured_at = dateForZone(parsedDate, "Asia/Singapore");
    }

    // Prevent duplicate inserts for the same profile within a short time window (±30s)
    if (values.measured_at) {
      try {
        const windowMs = 30 * 1000; // 30 seconds
        const windowStart = new Date(values.measured_at.getTime() - windowMs);
        const windowEnd = new Date(values.measured_at.getTime() + windowMs);

        const existing = await db
          .select()
          .from(watchMetrics)
          .where(
            and(
              eq(watchMetrics.profile_id, internalProfileId),
              gte(watchMetrics.measured_at, windowStart),
              lte(watchMetrics.measured_at, windowEnd),
            ),
          )
          .limit(1);

        if (existing && existing.length > 0) {
          return res.status(200).json({
            status: "Success",
            data: existing[0],
            message: "Existing record returned (duplicate prevented)",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error(
          "Error checking for existing watch metric:",
          err?.message ?? err,
        );
        // proceed to attempt insert (will surface DB error if any)
      }
    }

    try {
      const [created] = await db
        .insert(watchMetrics)
        .values(values)
        .returning();
      return res.status(201).json({
        status: "Success",
        data: created,
        timestamp: new Date().toISOString(),
      });
    } catch (dbError: any) {
      console.error(
        "DB insert error in createWatchMetric:",
        dbError?.message ?? dbError,
        {
          attemptedValues: values,
        },
      );
      return res.status(500).json({
        status: "Error",
        message: dbError?.message ?? "Failed to create watch metric",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error("createWatchMetric error:", error?.message ?? error);
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

    // Resolve account id -> internal profile id the same way as the create route
    const resolvedProfile = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.account_id, profile_id))
      .limit(1);

    let internalProfileId: string | null = null;
    if (resolvedProfile && resolvedProfile.length > 0) {
      internalProfileId = resolvedProfile[0].id;
    } else {
      const byId = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, profile_id))
        .limit(1);
      if (byId && byId.length > 0) internalProfileId = byId[0].id;
    }

    if (!internalProfileId) {
      return res.status(200).json({
        status: "Success",
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const conditions = [eq(watchMetrics.profile_id, internalProfileId)];

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
    console.error("getWatchMetrics error:", error?.message ?? error);
    return res.status(500).json({
      status: "Error",
      message: error?.message ?? "Failed to fetch watch metrics",
      timestamp: new Date().toISOString(),
    });
  }
};
