import { randomUUID } from "node:crypto";
import { normalizeProviderStreamError } from "@/lib/ai/errors";
import type { ModelProvider } from "@/lib/ai/model-provider";
import { shareSummaryOutputSchema } from "@/lib/ai/output-validation/contracts";
import {
	recordOutputValidationMetric,
	validateStructuredJsonText,
} from "@/lib/ai/output-validation/validator";
import { selectModelProvider } from "@/lib/ai/orchestrator";
import type { ProviderMessage } from "@/lib/chat-system-prompt";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import type { ShareSummaryData } from "@/lib/share/types";
import {
	buildUsageMeasurement,
	createUsageAttempt,
	estimateInputTokens,
	estimateOutputTokens,
	finalizeUsageEvent,
} from "@/lib/usage/usage-service";

interface SummaryResult {
	summary: ShareSummaryData | null;
	warning: string | null;
}

const SUMMARY_MODEL = "ministral-3b-latest";
const SUMMARY_PROMPT_VERSION = "share-summary-v1";

type ShareSummaryPrismaClient = any;

function buildShareSummaryMessages(
	messages: Array<{ role: "user" | "assistant"; content: string }>
): ProviderMessage[] {
	const conversation = messages
		.map((message) => {
			const role = message.role === "user" ? "User" : "Assistant";
			return `${role}: ${message.content.slice(0, 2000)}`;
		})
		.join("\n\n")
		.slice(0, 12000);

	if (!conversation.trim()) {
		return [];
	}

	return [
		{
			role: "user",
			content: [
				"Create a professional share summary for the selected conversation clips.",
				"Return strict JSON with this shape only:",
				'{"overview":"string","keyPoints":["string","string"]}',
				"Rules:",
				"- overview: 1 short paragraph, max 320 characters",
				"- keyPoints: 2 to 4 concise bullets",
				"- Do not mention masked values or invent missing context",
				"- Keep a professional, concise tone",
				"Conversation:",
				conversation,
			].join("\n"),
		},
	];
}

export async function generateShareSummary(options: {
	userId: string;
	conversationId: string;
	messages: Array<{ role: "user" | "assistant"; content: string }>;
	enabled: boolean;
	prismaClient?: ShareSummaryPrismaClient;
	provider?: ModelProvider;
	model?: string;
}): Promise<SummaryResult> {
	if (!options.enabled) {
		return { summary: null, warning: null };
	}

	if (!options.provider && !process.env.MISTRAL_API_KEY) {
		return {
			summary: null,
			warning:
				"Summary generation is unavailable until MISTRAL_API_KEY is configured.",
		};
	}

	const messages = buildShareSummaryMessages(options.messages);
	if (!messages.length) {
		return { summary: null, warning: null };
	}

	const model = options.model ?? SUMMARY_MODEL;
	const modelSelection = options.provider
		? { provider: options.provider, providerName: "custom", model }
		: selectModelProvider(model);
	if (!modelSelection) {
		return {
			summary: null,
			warning:
				"Summary generation is unavailable for the selected model.",
		};
	}

	const prismaClient = options.prismaClient ?? prisma;
	const deduplicationKey = `share-summary:${options.conversationId}:${randomUUID()}`;
	await createUsageAttempt({
		prismaClient,
		deduplicationKey,
		userId: options.userId,
		conversationId: options.conversationId,
		feature: "conversation_summary",
		provider: modelSelection.providerName,
		requestedModel: modelSelection.model,
		promptVersion: SUMMARY_PROMPT_VERSION,
	});

	let response: Awaited<ReturnType<ModelProvider["complete"]>> | null = null;
	try {
		response = await modelSelection.provider.complete({
			model: modelSelection.model,
			messages,
			maxTokens: 280,
			temperature: 0.2,
		});

		const validation = validateStructuredJsonText(
			shareSummaryOutputSchema,
			response.content
		);
		const overview = validation.value?.overview ?? "";
		const keyPoints = validation.value?.keyPoints ?? [];
		const measurement = buildUsageMeasurement({
			provider: modelSelection.providerName,
			requestedModel: modelSelection.model,
			resolvedModel: response.resolvedModel,
			providerRequestId: response.providerRequestId,
			providerUsage: response.usage,
			estimatedInputTokens: estimateInputTokens({
				messages,
				provider: modelSelection.providerName,
				model: modelSelection.model,
			}),
			estimatedOutputTokens: estimateOutputTokens({
				content: response.content,
				provider: modelSelection.providerName,
				model: modelSelection.model,
			}),
			outcome: overview ? "completed" : "failed",
			hasPartialOutput: Boolean(response.content),
		});

		if (!validation.ok) {
			await recordOutputValidationMetric({
				taskId: "share.summary",
				status: validation.status,
				provider: modelSelection.providerName,
				model: modelSelection.model,
				userId: options.userId,
				conversationId: options.conversationId,
				issueCount: validation.issues?.length ?? 0,
			});
			await finalizeUsageEvent({
				prismaClient,
				deduplicationKey,
				outcome: "failed",
				measurement,
				errorCode: validation.errorCode ?? "INVALID_SHARE_SUMMARY",
			});
			return {
				summary: null,
				warning: "Summary generation did not return a valid result.",
			};
		}

		await finalizeUsageEvent({
			prismaClient,
			deduplicationKey,
			outcome: "completed",
			measurement,
		});

		return {
			summary: {
				overview,
				keyPoints,
				model: response.resolvedModel ?? modelSelection.model,
				generatedAt: new Date().toISOString(),
			},
			warning: null,
		};
	} catch (error) {
		const normalized = normalizeProviderStreamError(error);
		await finalizeUsageEvent({
			prismaClient,
			deduplicationKey,
			outcome: "failed",
			measurement: buildUsageMeasurement({
				provider: modelSelection.providerName,
				requestedModel: modelSelection.model,
				resolvedModel: response?.resolvedModel,
				providerRequestId:
					normalized.providerRequestId ?? response?.providerRequestId,
				providerUsage: response?.usage,
				estimatedInputTokens: estimateInputTokens({
					messages,
					provider: modelSelection.providerName,
					model: modelSelection.model,
				}),
				estimatedOutputTokens: response
					? estimateOutputTokens({
							content: response.content,
							provider: modelSelection.providerName,
							model: modelSelection.model,
						})
					: 0,
				outcome: "failed",
				hasPartialOutput: Boolean(response?.content),
			}),
			errorCode: normalized.errorCode,
			providerStatusCode: normalized.providerStatusCode,
		});
		logServerError("share/summary", "generate_failed", error);
		return {
			summary: null,
			warning:
				"Summary generation failed. You can still share the selected messages.",
		};
	}
}
