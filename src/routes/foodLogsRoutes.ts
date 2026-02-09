import { Router } from "express"
import { getFoodByName } from "../controller/foodLogsController.ts";


const router = Router()

// Define here your routes.


router.get("/search/", getFoodByName);


export default router