import { Router } from "express"
import multer from "multer"
import {postFoodLogByAccountId, postLabelMacrosOnly} from "../controller/scannerController.ts";

const router = Router()

// Define here your routes.

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
})

router.post("/nutritional_label", upload.single("file"), postLabelMacrosOnly)
router.post("/nutritional_label/save", postFoodLogByAccountId)

export default router

