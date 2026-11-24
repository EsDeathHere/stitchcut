import { z } from "zod";

export const MAX_VIDEO_DURATION_SEC = 3600;
export const MAX_SEGMENTS = 500;

const finiteNonNegative = z
  .number()
  .finite()
  .min(0);

export const demoSegmentSchema = z
  .object({
    start: finiteNonNegative,
    end: finiteNonNegative,
    energy: finiteNonNegative,
  })
  .refine((seg) => seg.end >= seg.start, {
    message: "Segment duration (end - start) must be non-negative",
  });

export const cutRangeSchema = z
  .object({
    start: finiteNonNegative,
    end: finiteNonNegative,
  })
  .refine((seg) => seg.end >= seg.start, {
    message: "Segment duration (end - start) must be non-negative",
  });

export const planDemoCutsShape = {
  segments: z.array(demoSegmentSchema).max(MAX_SEGMENTS),
  videoDuration: z.number().finite().positive().max(MAX_VIDEO_DURATION_SEC),
  targetBudgetSec: finiteNonNegative,
};

export const validateCutPlanShape = {
  segments: z.array(cutRangeSchema).max(MAX_SEGMENTS),
  videoDuration: z.number().finite().positive().max(MAX_VIDEO_DURATION_SEC),
  targetBudgetSec: finiteNonNegative,
};

export const planDemoCutsSchema = z.object(planDemoCutsShape);
export const validateCutPlanSchema = z.object(validateCutPlanShape);
