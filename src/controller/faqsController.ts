import type { Request, Response } from "express";
import { db } from "../db/connection.ts";
import { faqs } from "../db/schema.ts";
import { eq } from "drizzle-orm";

// GET all FAQs
export const getAllFAQs = async (req: Request, res: Response) => {
  try {
    const allFAQs = await db.query.faqs.findMany();
    res.status(200).json(allFAQs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch FAQs" });
  }
};

// GET single FAQ by ID
export const getFAQById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const faq = await db.query.faqs.findFirst({
      where: eq(faqs.id, id),
    });
    if (!faq) {
      res.status(404).json({ error: "FAQ not found" });
      return;
    }
    res.status(200).json(faq);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch FAQ" });
  }
};

// POST create new FAQ
export const createFAQ = async (req: Request, res: Response) => {
  try {
    const { main_topic, question, answer } = req.body;

    const newFAQ = await db
      .insert(faqs)
      .values({
        main_topic,
        question,
        answer,
      })
      .returning();

    res.status(201).json(newFAQ[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create FAQ" });
  }
};
