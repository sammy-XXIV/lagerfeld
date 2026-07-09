import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { RUBRIC_SYSTEM_PROMPT, buildUserPrompt, type Occasion } from "./rubric.js";

const anthropic = new Anthropic();

export const FitCheckResultSchema = z.object({
  dress_code_match: z.enum(["under_dressed", "on_point", "over_dressed"]),
  color_coordination: z.number().min(0).max(10),
  fit_silhouette: z.number().min(0).max(10),
  occasion_flags: z.array(z.string()),
  overall_score: z.number().min(0).max(10),
  verdict: z.string(),
  one_fix: z.string(),
});

export type FitCheckResult = z.infer<typeof FitCheckResultSchema>;

const FIT_CHECK_TOOL: Anthropic.Tool = {
  name: "fit_check_result",
  description: "Return the structured outfit-appropriateness rating.",
  input_schema: {
    type: "object",
    properties: {
      dress_code_match: {
        type: "string",
        enum: ["under_dressed", "on_point", "over_dressed"],
      },
      color_coordination: { type: "number", minimum: 0, maximum: 10 },
      fit_silhouette: { type: "number", minimum: 0, maximum: 10 },
      occasion_flags: { type: "array", items: { type: "string" } },
      overall_score: { type: "number", minimum: 0, maximum: 10 },
      verdict: { type: "string" },
      one_fix: { type: "string" },
    },
    required: [
      "dress_code_match",
      "color_coordination",
      "fit_silhouette",
      "occasion_flags",
      "overall_score",
      "verdict",
      "one_fix",
    ],
  },
};

export async function runFitCheck(
  imageBase64: string,
  imageMediaType: "image/jpeg" | "image/png" | "image/webp",
  occasion: Occasion
): Promise<FitCheckResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: RUBRIC_SYSTEM_PROMPT,
    tools: [FIT_CHECK_TOOL],
    tool_choice: { type: "tool", name: "fit_check_result" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: buildUserPrompt(occasion),
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Model did not return a structured result");
  }

  return FitCheckResultSchema.parse(toolUse.input);
}
