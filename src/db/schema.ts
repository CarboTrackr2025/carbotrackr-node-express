import {
  pgTableCreator,
  uuid,
  check,
  varchar,
  timestamp,
  date,
  integer,
  numeric,
  text,
  pgEnum,
  time,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

const createTable = pgTableCreator((name) => name);

export const accounts = createTable("accounts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
});

export const sexEnum = pgEnum("sex", ["MALE", "FEMALE"]);
export const diagnosedWithEnum = pgEnum("diagnosed_with", [
  "TYPE_2_DIABETES",
  "PRE_DIABETES",
  "NOT_APPLICABLE",
]);
export const profiles = createTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    account_id: varchar("account_id", { length: 255 })
      .references(() => accounts.id, { onDelete: "cascade" })
      .notNull(),
    sex: sexEnum("sex").notNull(),
    date_of_birth: date("date_of_birth", { mode: "date" }).notNull(),
    height_cm: numeric("height_cm", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    weight_kg: numeric("weight_kg", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    diagnosed_with: diagnosedWithEnum("diagnosed_with").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    check("profiles_height_cm_gt_0", sql`${t.height_cm} > 0`),
    check("profiles_weight_kg_gt_0", sql`${t.weight_kg} > 0`),
  ],
);


export const healthMetrics = createTable(
    "health_metrics",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        profile_id: uuid("profile_id")
            .references(() => profiles.id, { onDelete: "cascade" })
            .notNull(),
        daily_calorie_goal_kcal: integer("daily_calorie_goal_kcal").notNull(),
        daily_carbohydrate_goal_g: numeric("daily_carbohydrate_goal_g", {
            precision: 5,
            scale: 2,
            mode: "number",
        }).notNull(),
        reminder_frequency: integer("reminder_frequency").notNull(),
        reminder_time: time("reminder_time", { precision: 6 }).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (t) => [
        check(
            "health_metrics_daily_calorie_goal_kcal_gt_0",
            sql`${t.daily_calorie_goal_kcal} > 0`,
        ),
        check(
            "health_metrics_daily_carbohydrate_goal_g_gt_0",
            sql`${t.daily_carbohydrate_goal_g} > 0`,
        ),
        check(
            "health_metrics_reminder_frequency_0_to_3",
            sql`${t.reminder_frequency} BETWEEN 0 AND 3`,
        ),
    ],
);

export const bloodPressureMeasurements = createTable(
  "blood_pressure_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    systolic_mmHg: integer("systolic_mmHg").notNull(),
    diastolic_mmHg: integer("diastolic_mmHg").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    check("blood_pressure_systolic_mmHg_gt_0", sql`${t.systolic_mmHg} > 0`),
    check("blood_pressure_diastolic_mmHg_gt_0", sql`${t.diastolic_mmHg} > 0`),
  ],
);


export const bloodGlucoseMeasurements = createTable(
  "blood_glucose_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    level: numeric("level", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [check("blood_glucose_level_gt_0", sql`${t.level} > 0`)],
);

export const mealTypeEnum = pgEnum("meal_type", [
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
]);
export const foodSourceTypeEnum = pgEnum("food_source_type", [
  "FAT_SECRET_API",
  "AWS_API",
  "GOOGLE_GEMINI_API",
]);
export const foodLogs = createTable(
  "food_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    food_name: varchar("food_name", { length: 255 }).notNull(),
    serving_size_g: numeric("serving_size_g", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    serving_size_ml: numeric("serving_size_ml", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    number_of_servings: integer("number_of_servings").notNull(),
    meal_type: mealTypeEnum("meal_type").notNull(),
    calories_kcal: integer("calories_kcal").notNull(),
    carbohydrates_g: numeric("carbohydrates_g", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    protein_g: numeric("protein_g", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    fat_g: numeric("fat_g", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    source_type: foodSourceTypeEnum("source_type").notNull(),
    source_id: varchar("source_id", { length: 255 }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    check("food_logs_serving_size_g_gt_0", sql`${t.serving_size_g} > 0`),
    check("food_logs_calories_kcal_gte_0", sql`${t.calories_kcal} >= 0`),
    check("food_logs_carbohydrates_g_gte_0", sql`${t.carbohydrates_g} >= 0`),
    check("food_logs_protein_g_gte_0", sql`${t.protein_g} >= 0`),
    check("food_logs_fat_g_gte_0", sql`${t.fat_g} >= 0`),
  ],
);

export const topicTypeEnum = pgEnum("faq_main_topic", [
  "ACCOUNT",
  "HEALTH",
  "FOOD_LOG",
  "SCANNERS",
  "REPORTS",
]);
export const faqs = createTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  main_topic: topicTypeEnum("main_topic").notNull(),
  question: varchar("question", { length: 500 }).notNull(),
  answer: text("answer").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const inquiries = createTable("inquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: varchar("subject", { length: 500 }).notNull(),
  message: text("message").notNull(),
  email_address: varchar("email_address", { length: 255 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const calorieData = createTable(
  "calorie_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    calorie_goal_kcal: integer("calorie_goal_kcal").notNull(),
    calorie_actual_kcal: integer("calorie_actual_kcal").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    check(
      "calorie_data_calorie_goal_kcal_gt_0",
      sql`${t.calorie_goal_kcal} > 0`,
    ),
    check(
      "calorie_data_calorie_actual_kcal_gt_0",
      sql`${t.calorie_actual_kcal} > 0`,
    ),
  ],
);

export const carbohydrateData = createTable(
  "carbohydrate_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    carbohydrate_goal_g: numeric("carbohydrate_goal_g", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    carbohydrate_actual_g: numeric("carbohydrate_actual_g", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    check(
      "carbohydrate_data_carbohydrate_goal_g_gt_0",
      sql`${t.carbohydrate_goal_g} > 0`,
    ),
    check(
      "carbohydrate_data_carbohydrate_actual_g_gt_0",
      sql`${t.carbohydrate_actual_g} > 0`,
    ),
  ],
);

// Smartwatch Health Data Tables
// Heart rate measurements from smartwatch (Wear OS)
export const heartRateMeasurements = createTable(
  "heart_rate_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    heart_rate_bpm: integer("heart_rate_bpm").notNull(), // Beats per minute
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    check("heart_rate_bpm_gt_0", sql`${t.heart_rate_bpm} > 0`),
    check("heart_rate_bpm_lt_300", sql`${t.heart_rate_bpm} < 300`), // Reasonable upper limit
  ],
);

// Steps data from smartwatch (Wear OS)
export const stepsMeasurements = createTable(
  "steps_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    steps_count: integer("steps_count").notNull(), // Number of steps
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [check("steps_count_gte_0", sql`${t.steps_count} >= 0`)],
);

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  account: one(accounts, {
    fields: [profiles.account_id],
    references: [accounts.id],
  }),

  healthMetrics: one(healthMetrics, {
    fields: [profiles.id],
    references: [healthMetrics.profile_id],
  }),

  bloodPressureMeasurements: many(bloodPressureMeasurements),
  bloodGlucoseMeasurements: many(bloodGlucoseMeasurements),
  foodLogs: many(foodLogs),
  calorieData: many(calorieData),
  carbohydrateData: many(carbohydrateData),
  heartRateMeasurements: many(heartRateMeasurements),
  stepsMeasurements: many(stepsMeasurements),
}));

export const healthMetricsRelations = relations(healthMetrics, ({ one }) => ({
  profile: one(profiles, {
    fields: [healthMetrics.profile_id],
    references: [profiles.id],
  }),
}));

export const bloodPressureMeasurementsRelations = relations(
  bloodPressureMeasurements,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [bloodPressureMeasurements.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const bloodGlucoseMeasurementsRelations = relations(
  bloodGlucoseMeasurements,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [bloodGlucoseMeasurements.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const foodLogsRelations = relations(foodLogs, ({ one }) => ({
  profile: one(profiles, {
    fields: [foodLogs.profile_id],
    references: [profiles.id],
  }),
}));

export const calorieDataRelations = relations(calorieData, ({ one }) => ({
  profile: one(profiles, {
    fields: [calorieData.profile_id],
    references: [profiles.id],
  }),
}));

export const carbohydrateDataRelations = relations(
  carbohydrateData,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [carbohydrateData.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const heartRateMeasurementsRelations = relations(
  heartRateMeasurements,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [heartRateMeasurements.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const stepsMeasurementsRelations = relations(
  stepsMeasurements,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [stepsMeasurements.profile_id],
      references: [profiles.id],
    }),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type BloodPressureMeasurement =
  typeof bloodPressureMeasurements.$inferSelect;
export type BloodGlucoseMeasurement =
  typeof bloodGlucoseMeasurements.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type FAQ = typeof faqs.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type CalorieData = typeof calorieData.$inferSelect;
export type CarbohydrateData = typeof carbohydrateData.$inferSelect;
export type HeartRateMeasurement = typeof heartRateMeasurements.$inferSelect;
export type StepsMeasurement = typeof stepsMeasurements.$inferSelect;

export const insertProfileSchema = createInsertSchema(profiles);
export const selectProfileSchema = createSelectSchema(profiles);

export const insertHealthMetricSchema = createInsertSchema(healthMetrics);
export const selectHealthMetricSchema = createSelectSchema(healthMetrics);

export const insertBloodPressureMeasurementSchema = createInsertSchema(
  bloodPressureMeasurements,
);
export const selectBloodPressureMeasurementSchema = createSelectSchema(
  bloodPressureMeasurements,
);

export const insertBloodGlucoseMeasurementSchema = createInsertSchema(
  bloodGlucoseMeasurements,
);
export const selectBloodGlucoseMeasurementSchema = createSelectSchema(
  bloodGlucoseMeasurements,
);

export const insertFoodLogSchema = createInsertSchema(foodLogs);
export const selectFoodLogSchema = createSelectSchema(foodLogs);

export const insertFAQSchema = createInsertSchema(faqs);
export const selectFAQSchema = createSelectSchema(faqs);

export const insertInquirySchema = createInsertSchema(inquiries);
export const selectInquirySchema = createSelectSchema(inquiries);

export const insertCalorieDataSchema = createInsertSchema(calorieData);
export const selectCalorieDataSchema = createSelectSchema(calorieData);

export const insertCarbohydrateDataSchema =
  createInsertSchema(carbohydrateData);
export const selectCarbohydrateDataSchema =
  createSelectSchema(carbohydrateData);

export const insertHeartRateMeasurementSchema = createInsertSchema(
  heartRateMeasurements,
);
export const selectHeartRateMeasurementSchema = createSelectSchema(
  heartRateMeasurements,
);

export const insertStepsMeasurementSchema =
  createInsertSchema(stepsMeasurements);
export const selectStepsMeasurementSchema =
  createSelectSchema(stepsMeasurements);
