import { Router } from "express"
import {getFoodByQuery, getFoodDetailsByServingId, postFoodLog} from "../controller/foodLogsController.ts";


const router = Router()

// Define here your routes.


router.get("/search", getFoodByQuery);
router.get("/food/:food_id/serving/:serving_id", getFoodDetailsByServingId);
router.post("/create", postFoodLog)

export default router