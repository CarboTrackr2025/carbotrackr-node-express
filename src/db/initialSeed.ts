// Dummy Data Applicable for Initial Database Seeding

import {db} from "./connection.ts"
import {
    accounts,
    profiles,
    healthMetrics,
    bloodPressureMeasurements,
    bloodGlucoseMeasurements,
    calorieData,
    carbohydrateData,
    foodLogs,
    faqs,
    inquiries
} from "./schema.ts"
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const seed = () => async() => {
    console.log("🌱 Start database seed...")

    try
    {
        console.log("Clearing existing data...")
        await db.delete(accounts)
        await db.delete(profiles)
        await db.delete(healthMetrics)
        await db.delete(bloodPressureMeasurements)
        await db.delete(bloodGlucoseMeasurements)
        await db.delete(calorieData)
        await db.delete(carbohydrateData)
        await db.delete(foodLogs)
        await db.delete(faqs)
        await db.delete(inquiries)

        // console.log("Creating demo account")
        // const [demoAccount] = await db.insert(accounts).values({
        //     id: "demo-account-id",
        //     email: "demo@gmail.com",
        // }).returning()
        //
        // console.log("Creating demo profile")
        // const [demoProfile] = await db.insert(profiles).values({
        //     id: randomUUID(),
        //     account_id: demoAccount.id,
        //     sex: "MALE",
        //     date_of_birth: new Date(2001, 4, 15),
        //     height_cm: 175.25,
        //     weight_kg: 73.20,
        //     diagnosed_with: "TYPE_2_DIABETES",
        // }).returning()
        //
        // console.log("Creating health metrics for demo profile")
        // const [demoHealthMetrics] = await db.insert(healthMetrics).values({
        //     profile_id: demoProfile.id,
        //     daily_calorie_goal_kcal: 1203,
        //     daily_carbohydrate_goal_g: 45.90,
        //     reminder_frequency: 1,
        // }).returning()
        //
        // console.log("Creating blood pressure measurements for demo profile")
        // await db.insert(bloodPressureMeasurements).values([
        //     {
        //         profile_id: demoProfile.id,
        //         systolic_mmHg: 120,
        //         diastolic_mmHg: 80,
        //     },
        //     {
        //         profile_id: demoProfile.id,
        //         systolic_mmHg: 130,
        //         diastolic_mmHg: 85,
        //     },
        //     {
        //         profile_id: demoProfile.id,
        //         systolic_mmHg: 125,
        //         diastolic_mmHg: 82,
        //     },
        // ])
        //
        // console.log("Creating blood glucose measurements for demo profile")
        //
        // await db.insert(bloodGlucoseMeasurements).values([
        //     {
        //         profile_id: demoProfile.id,
        //         level: 5.5,
        //         units: "MG_DL",
        //     },
        //     {
        //         profile_id: demoProfile.id,
        //         level: 6.2,
        //         units: "MG_DL",
        //     },
        //     {
        //         profile_id: demoProfile.id,
        //         level: 5.8,
        //         units: "MG_DL",
        //     },
        // ])

    }
    catch(e)
    {
        console.error('❌ Database seeded failed:', e)
    }
}


// This code is used to prevent automatic execution when the file is imported elsewhere
if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
    seed()()
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
}

export default seed