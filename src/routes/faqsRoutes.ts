import { Router } from "express";
import {
  getAllFAQs,
  getFAQById,
  createFAQ,
} from "../controller/faqsController.ts";
import { validateFAQInput } from "../middleware/validation.ts";

const router = Router();

// GET all FAQs
router.get("/", getAllFAQs);

// GET single FAQ by ID
router.get("/:id", getFAQById);

// POST create new FAQ
router.post("/", validateFAQInput, createFAQ);

export default router;
