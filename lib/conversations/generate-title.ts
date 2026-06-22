import { randomUUID } from "node:crypto";
import { normalizeProviderStreamError } from "@/lib/ai/errors";
import type { ModelProvider } from "@/lib/ai/model-provider";
import {
	conversationTitleOutputSchema,
	type ConversationTitleOutput,
} from "@/lib/ai/output-validation/contracts";
import {
	recordOutputValidationMetric,
	validateStructuredJsonText,
	validateStructuredOutput,
} from "@/lib/ai/output-validation/validator";
import { selectModelProvider } from "@/lib/ai/orchestrator";
import type { ProviderMessage } from "@/lib/chat-system-prompt";
import { prisma } from "@/lib/prisma";
import {
	buildUsageMeasurement,
	createUsageAttempt,
	estimateInputTokens,
	estimateOutputTokens,
	finalizeUsageEvent,
	finalizeUsageEventInTransaction,
} from "@/lib/usage/usage-service";

const TITLE_MODEL = "ministral-3b-latest";
const TITLE_PROMPT_VERSION = "conversation-title-v1";

type TitlePrismaClient = any;

export class ConversationTitleGenerationError extends Error {
	public readonly code:
		| "CONVERSATION_NOT_FOUND"
		| "NOT_ENOUGH_MESSAGES"
		| "PROVIDER_UNAVAILABLE"
		| "EMPTY_TITLE";

	constructor(
		message: string,
		code:
			| "CONVERSATION_NOT_FOUND"
			| "NOT_ENOUGH_MESSAGES"
			| "PROVIDER_UNAVAILABLE"
			| "EMPTY_TITLE"
	) {
		super(message);
		this.name = "ConversationTitleGenerationError";
		this.code = code;
	}
}

export async function getConversationTitleGenerationInput(
	options: {
		conversationId: string;
		userId: string;
		organizationId?: string | null;
	},
	prismaClient: TitlePrismaClient = prisma
) {
	const conversation = await prismaClient.conversation.findFirst({
		where: {
			id: options.conversationId,
			userId: options.userId,
			...(options.organizationId !== undefined
				? { organizationId: options.organizationId }
				: {}),
		},
		include: {
			messages: {
				orderBy: { createdAt: "asc" },
				take: 4,
				select: {
					role: true,
					content: true,
				},
			},
		},
	});

	if (!conversation) {
		throw new ConversationTitleGenerationError(
			"Conversation not found",
			"CONVERSATION_NOT_FOUND"
		);
	}

	if (conversation.messages.length < 2) {
		throw new ConversationTitleGenerationError(
			"Not enough messages to generate title",
			"NOT_ENOUGH_MESSAGES"
		);
	}

	return conversation;
}

export function buildConversationTitleMessages(conversation: {
	messages: Array<{ role: string; content: string }>;
}): ProviderMessage[] {
	const messageContext = conversation.messages
		.map((message) => `${message.role}: ${message.content.slice(0, 500)}`)
		.join("\n\n");

	return [
		{
			role: "user",
			content: `Based on the following conversation, generate a concise, descriptive title (3-6 words). Return strict JSON only with this shape: {"title":"string"}.\n\nConversation:\n${messageContext}\n\nJSON:`,
		},
	];
}

function validateTitleResponse(content: string) {
	const jsonValidation = validateStructuredJsonText(
		conversationTitleOutputSchema,
		content
	);
	if (jsonValidation.ok) return jsonValidation;

	const fallbackTitle = content
		.replace(/^["']|["']$/g, "")
		.replace(/\n/g, " ")
		.trim()
		.slice(0, 100);

	return validateStructuredOutput<ConversationTitleOutput>(
		conversationTitleOutputSchema,
		{ title: fallbackTitle }
	);
}

export async function generateConversationTitle({
	conversationId,
	userId,
	prismaClient = prisma,
	provider,
	model = TITLE_MODEL,
}: {
	conversationId: string;
	userId: string;
	prismaClient?: TitlePrismaClient;
	provider?: ModelProvider;
	model?: string;
}) {
	const conversation = await getConversationTitleGenerationInput(
		{ conversationId, userId },
		prismaClient
	);
	const modelSelection = provider
		? { provider, providerName: "custom", model }
		: selectModelProvider(model);

	if (!modelSelection) {
		throw new ConversationTitleGenerationError(
			"Title model is unavailable",
			"PROVIDER_UNAVAILABLE"
		);
	}

	const messages = buildConversationTitleMessages(conversation);
	const deduplicationKey = `conversation-title:${conversationId}:${randomUUID()}`;
	await createUsageAttempt({
		prismaClient,
		deduplicationKey,
		userId,
		organizationId: conversation.organizationId ?? null,
		conversationId,
		feature: "conversation_title",
		provider: modelSelection.providerName,
		requestedModel: modelSelection.model,
		promptVersion: TITLE_PROMPT_VERSION,
	});

	let response: Awaited<ReturnType<ModelProvider["complete"]>> | null = null;
	try {
		response = await modelSelection.provider.complete({
			model: modelSelection.model,
			messages,
		});
		const validation = validateTitleResponse(response.content);
		const cleanTitle = validation.value?.title ?? "";
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
			outcome: cleanTitle ? "completed" : "failed",
			hasPartialOutput: Boolean(response.content),
		});

		if (!cleanTitle) {
			await recordOutputValidationMetric({
				taskId: "conversation.title",
				status: validation.status,
				provider: modelSelection.providerName,
				model: modelSelection.model,
				userId,
				conversationId,
				issueCount: validation.issues?.length ?? 0,
			});
			await finalizeUsageEvent({
				prismaClient,
				deduplicationKey,
				outcome: "failed",
				measurement,
				errorCode: validation.errorCode ?? "EMPTY_TITLE",
			});
			throw new ConversationTitleGenerationError(
				"Title generation returned an empty title",
				"EMPTY_TITLE"
			);
		}

		await prismaClient.$transaction(
			async (transaction: TitlePrismaClient) => {
				await transaction.conversation.update({
					where: { id: conversationId },
					data: { title: cleanTitle },
				});
				await finalizeUsageEventInTransaction({
					prismaClient: transaction,
					deduplicationKey,
					outcome: "completed",
					measurement,
				});
			}
		);

		return {
			title: cleanTitle,
			conversationId,
		};
	} catch (error) {
		if (error instanceof ConversationTitleGenerationError) {
			throw error;
		}

		const normalized = normalizeProviderStreamError(error);
		const measurement = buildUsageMeasurement({
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
		});
		await finalizeUsageEvent({
			prismaClient,
			deduplicationKey,
			outcome: "failed",
			measurement,
			errorCode: normalized.errorCode,
			providerStatusCode: normalized.providerStatusCode,
		});
		throw error;
	}
}
