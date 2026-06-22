import { z } from "zod";

const safeText = z.string().trim().min(1);

export const conversationTitleOutputSchema = z.object({
	title: safeText.max(100),
});

export const shareSummaryOutputSchema = z.object({
	overview: safeText.max(320),
	keyPoints: z.array(safeText.max(180)).min(1).max(4),
});

export const citationValidationOutputSchema = z.object({
	sentence: safeText.max(1_000),
	citedChunkId: safeText.max(200),
	verdict: z.enum(["supported", "partially_supported", "unsupported"]),
	unsupportedReason: z.string().trim().max(500).optional(),
});

export const feedbackClassificationOutputSchema = z.object({
	label: z.enum([
		"incorrect",
		"unsupported_by_source",
		"wrong_source",
		"missing_source",
		"ignored_instruction",
		"unsafe",
		"too_slow",
		"formatting",
		"wrong_model",
		"other",
	]),
	confidence: z.enum(["low", "medium", "high"]),
});

export const evalJudgeResultOutputSchema = z.object({
	score: z.number().min(0).max(1),
	pass: z.boolean(),
	reasons: z.array(z.string().trim().min(1).max(240)).max(10),
});

export const moderationClassificationOutputSchema = z.object({
	action: z.enum(["allow", "review", "block"]),
	categories: z.array(z.string().trim().min(1).max(80)).max(12),
	userMessage: z.string().trim().max(500).optional(),
});

export type ConversationTitleOutput = z.infer<
	typeof conversationTitleOutputSchema
>;
export type ShareSummaryOutput = z.infer<typeof shareSummaryOutputSchema>;
export type CitationValidationOutput = z.infer<
	typeof citationValidationOutputSchema
>;
