import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { z } from "zod";
import { insertFAQSchema } from "../db/schema.ts";

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({
          error: "Something went wrong during request validation",
          details: z.flattenError(e),
        });
      }
      next(e);
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params);
      next();
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({
          error: "Something went wrong during params validation",
          details: z.flattenError(e),
        });
      }
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({
          error: "Something went wrong during query validation",
          details: z.flattenError(e),
        });
      }
    }
  };
};
export const validateFAQInput = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validated = insertFAQSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    res.status(400).json({ error: "Invalid FAQ input", details: error });
  }
};
