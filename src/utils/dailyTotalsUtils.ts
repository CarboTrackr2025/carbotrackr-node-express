import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/connection.ts";
import {
  calorieData,
  carbohydrateData,
  foodLogs,
  healthMetrics,
} from "../db/schema.ts";

export const DEFAULT_TIME_ZONE = "Asia/Singapore";

export const getDayBoundsInTimeZone = (
  dateInput?: Date | string | null,
  timeZone = DEFAULT_TIME_ZONE,
) => {
  const date = dateInput ? new Date(dateInput) : new Date();

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const start = new Date(`${localDate}T00:00:00.000+08:00`);
  const end = new Date(`${localDate}T23:59:59.999+08:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return {
    date: localDate,
    start,
    end,
  };
};

export async function recalculateDailyTotals(
  profile_id: string,
  date: Date,
): Promise<void> {
  const bounds = getDayBoundsInTimeZone(date);
  if (!bounds) {
    return;
  }

  const { start, end } = bounds;

  const logs = await db
    .select({
      calories_kcal: foodLogs.calories_kcal,
      carbohydrates_g: foodLogs.carbohydrates_g,
    })
    .from(foodLogs)
    .where(
      and(
        eq(foodLogs.profile_id, profile_id),
        gte(foodLogs.created_at, start),
        lte(foodLogs.created_at, end),
      ),
    );

  const totalCalories = logs.reduce(
    (sum, l) => sum + (l.calories_kcal ?? 0),
    0,
  );
  const totalCarbs = logs.reduce(
    (sum, l) => sum + Number(l.carbohydrates_g ?? 0),
    0,
  );

  const metrics = await db
    .select({
      daily_calorie_goal_kcal: healthMetrics.daily_calorie_goal_kcal,
      daily_carbohydrate_goal_g: healthMetrics.daily_carbohydrate_goal_g,
    })
    .from(healthMetrics)
    .where(eq(healthMetrics.profile_id, profile_id))
    .limit(1);

  const calorieGoal = metrics[0]?.daily_calorie_goal_kcal ?? 2000;
  const carbGoal = Number(metrics[0]?.daily_carbohydrate_goal_g ?? 250);

  const existingCalorie = await db
    .select({ id: calorieData.id })
    .from(calorieData)
    .where(
      and(
        eq(calorieData.profile_id, profile_id),
        gte(calorieData.created_at, start),
        lte(calorieData.created_at, end),
      ),
    )
    .limit(1);

  if (existingCalorie[0]) {
    await db
      .update(calorieData)
      .set({
        calorie_actual_kcal: Math.max(totalCalories, 1),
        calorie_goal_kcal: calorieGoal,
      })
      .where(eq(calorieData.id, existingCalorie[0].id));
  } else {
    await db.insert(calorieData).values({
      profile_id,
      calorie_goal_kcal: calorieGoal,
      calorie_actual_kcal: Math.max(totalCalories, 1),
    });
  }

  const existingCarb = await db
    .select({ id: carbohydrateData.id })
    .from(carbohydrateData)
    .where(
      and(
        eq(carbohydrateData.profile_id, profile_id),
        gte(carbohydrateData.created_at, start),
        lte(carbohydrateData.created_at, end),
      ),
    )
    .limit(1);

  if (existingCarb[0]) {
    await db
      .update(carbohydrateData)
      .set({
        carbohydrate_actual_g: Math.max(totalCarbs, 0.01),
        carbohydrate_goal_g: carbGoal,
      })
      .where(eq(carbohydrateData.id, existingCarb[0].id));
  } else {
    await db.insert(carbohydrateData).values({
      profile_id,
      carbohydrate_goal_g: carbGoal,
      carbohydrate_actual_g: Math.max(totalCarbs, 0.01),
    });
  }
}
