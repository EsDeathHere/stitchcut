#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { planCuts, validateCutPlan } from "./plan.js";

const server = new McpServer({ name: "stitchcut-mcp", version: "0.1.0" });

const rangeShape = {
  start: z.number().min(0),
  end: z.number().min(0),
};

server.registerTool(
  "plan_demo_cuts",
  {
    title: "Plan demo cuts",
    description:
      "Merge overlapping segments, keep the highest-energy material within targetBudgetSec, and return a chronological cut plan.",
    inputSchema: {
      segments: z.array(z.object({ ...rangeShape, energy: z.number().min(0) })),
      videoDuration: z.number().positive(),
      targetBudgetSec: z.number().min(0),
    },
  },
  async ({ segments, videoDuration, targetBudgetSec }) => {
    const clamped = segments.filter((s) => s.start < s.end && s.end <= videoDuration);
    return {
      content: [
        { type: "text", text: JSON.stringify(planCuts(clamped, targetBudgetSec), null, 2) },
      ],
    };
  },
);

server.registerTool(
  "validate_cut_plan",
  {
    title: "Validate cut plan",
    description:
      "Check a cut plan is chronological, non-overlapping, inside videoDuration, and within targetBudgetSec.",
    inputSchema: {
      segments: z.array(z.object(rangeShape)),
      videoDuration: z.number().positive(),
      targetBudgetSec: z.number().min(0),
    },
  },
  async ({ segments, videoDuration, targetBudgetSec }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(validateCutPlan(segments, videoDuration, targetBudgetSec), null, 2),
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
