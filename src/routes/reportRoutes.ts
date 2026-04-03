import { Router } from "express"
import { getCalorieReport, getCarbohydrateReport } from "../controller/reportController.ts"

const router = Router()

// GET /report/calories?accountId=&startDate=&endDate=
router.get("/calories", getCalorieReport)

// GET /report/carbohydrates?accountId=&startDate=&endDate=
router.get("/carbohydrates", getCarbohydrateReport)

export default router