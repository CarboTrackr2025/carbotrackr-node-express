import type { Request, Response } from "express";
import { db } from "../db/connection.ts";
import { inquiries } from "../db/schema.ts";
import { z } from "zod";

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation schema for inquiry
const submitInquirySchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(500, "Subject must be 500 characters or less"),
  message: z.string().min(1, "Message is required"),
  email_address: z
    .string()
    .email("Invalid email address")
    .or(z.string().regex(emailRegex, "Invalid email address")),
});

type SubmitInquiryRequest = z.infer<typeof submitInquirySchema>;

/**
 * POST /contacts - Submit a new contact inquiry
 * Accepts: { subject, message, email_address }
 * Returns: { success, message, data: { id, subject, message, email_address, created_at } }
 */
export async function submitInquiry(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = submitInquirySchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        details: validationResult.error.flatten(),
      });
    }

    const { subject, message, email_address } = validationResult.data;

    // Insert inquiry into database
    const newInquiry = await db
      .insert(inquiries)
      .values({
        subject,
        message,
        email_address,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message:
        "Your inquiry has been submitted successfully. We will get back to you soon.",
      data: newInquiry[0],
    });
  } catch (error: any) {
    console.error("Error submitting inquiry:", error);

    // Handle specific database errors
    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A duplicate record was detected.",
      });
    }

    if (error?.code === "23502") {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "An error occurred while submitting your inquiry. Please try again later.",
    });
  }
}
