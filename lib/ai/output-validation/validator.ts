import { createHash } from "node:crypto";
import { recordOperationalMetric } from "@/lib/operational-metrics";
import type { z } from "zod";

export type OutputValidationStatus =
	| "valid"
	| "schema_invalid"
	| "citation_unsupported"
	| "refusal_expected"
	| "markdown_unsafe";

export interface OutputValidationResult<T> {
	ok: boolean;
	status: OutputValidationStatus;
	value: T | null;
	errorCode?: string;
	issues?: Array<{ path: string; message: string }>;
}

export function extractJsonObject(text: string): unknown {
	const firstBrace = text.indexOf("{");
	const lastBrace = text.lastIndexOf("}");
	if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
		return null;
	}

	try {
		return JSON.parse(text.slice(firstBrace, lastBrace + 1));
	} catch {
		return null;
	}
}

export function validateStructuredOutput<T>(
	schema: z.ZodType<T>,
	payload: unknown
): OutputValidationResult<T> {
	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		return {
			ok: false,
			status: "schema_invalid",
			value: null,
			errorCode: "AI_OUTPUT_SCHEMA_INVALID",
			issues: parsed.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			})),
		};
	}

	return { ok: true, status: "valid", value: parsed.data };
}

export function validateStructuredJsonText<T>(
	schema: z.ZodType<T>,
	text: string
): OutputValidationResult<T> {
	return validateStructuredOutput(schema, extractJsonObject(text));
}

export async function recordOutputValidationMetric(options: {
	taskId: string;
	status: OutputValidationStatus;
	provider?: string | null;
	model?: string | null;
	traceId?: string | null;
	userId?: string | null;
	organizationId?: string | null;
	conversationId?: string | null;
	issueCount?: number;
}) {
	await recordOperationalMetric({
		kind: "ai_output_validation",
		source: options.taskId,
		status: options.status,
		provider: options.provider ?? null,
		model: options.model ?? null,
		userId: options.userId ?? null,
		organizationId: options.organizationId ?? null,
		conversationId: options.conversationId ?? null,
		traceId: options.traceId ?? null,
		metadata: {
			issueCount: options.issueCount ?? 0,
		},
	});
}

export function contentFingerprint(content: string) {
	return createHash("sha256").update(content).digest("hex").slice(0, 24);
}
