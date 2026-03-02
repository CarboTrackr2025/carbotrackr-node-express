import { Router } from "express";
import { submitInquiry } from "../controller/contactController.ts";

const router = Router();

// POST /contacts - Submit a new contact inquiry
router.post("/", submitInquiry);

export default router;
