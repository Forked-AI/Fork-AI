import {
	buildChatContext,
	PromptInputBudgetExceededError,
	type ChatContextBuildResult,
	type ChatContextMetadata,
} from "@/lib/ai/context-builder";
import { normalizeProviderStreamError } from "@/lib/ai/errors";
import { DEFAULT_MODEL_CAPABILITIES } from "@/lib/ai/model-catalog";
import type { ModelProvider, ModelUsage } from "@/lib/ai/model-provider";
import {
	getModelFallbackCandidates,
	type ModelCapabilities,
} from "@/lib/ai/orchestrator";
import { resilientModelStream } from "@/lib/ai/resilience";
import {
	applyVisionAttachmentsToLastUserMessage,
	AttachmentValidationError,
	buildVisionContentParts,
	createMessageAttachmentRows,
	getRagFileIdsFromAttachments,
	loadPersistedMessageAttachments,
	prepareMessageAttachments,
	type AttachmentRequestInput,
	type PreparedMessageAttachment,
} from "@/lib/attachments/attachment-service";
import {
	enqueueSseEvent,
	type ChatStreamErrorReplayBody,
	type ChatStreamReplayBody,
	toJsonValue,
} from "@/lib/ai/stream-events";
import type { ConversationMessage } from "@/lib/chat-system-prompt";
import {
	buildGuestMessageHistory,
	loadMessageHistory,
	type MessageHistoryPrismaClient,
} from "@/lib/chat/message-history";
import {
	completeGeneration,
	createGenerationAttempt,
	failGeneration,
	flushGenerationContent,
	moderateGeneration,
	type GenerationAttempt,
} from "@/lib/chat/generation-service";
import { enqueueConversationSummaryJob } from "@/lib/queue/conversation";
import {
	registerGenerationAbortController,
	unregisterGenerationAbortController,
} from "@/lib/chat/generation-abort-registry";
import {
	getModelAccessError,
	isModelIncludedInPlan,
} from "@/lib/model-entitlements";
import { prisma } from "@/lib/prisma";
import {
	logServerError,
	logServerInfo,
	logServerWarning,
} from "@/lib/server-safe-log";
import { recordOperationalMetric } from "@/lib/operational-metrics";
import {
	persistSkillTraceForGeneration,
	renderActiveSkillContext,
	resolveActiveSkillTrace,
	stripSkillTraceForStorage,
} from "@/lib/skills/service";
import { proposeToolExecution } from "@/lib/tools/router";
import type {
	ActiveSkillTrace,
	SkillActivationInput,
} from "@/lib/skills/catalog";
import {
	checkTokenBudgetBeforeRequest,
	type TokenBudgetCheckResult,
} from "@/lib/token-budget";
import type { ActiveIdempotencyRecord, JsonValue } from "@/lib/idempotency";
import {
	buildUsageMeasurement,
	createUsageAttempt,
	estimateInputTokens,
	estimateOutputTokens,
	finalizeUsageEvent,
} from "@/lib/usage/usage-service";
import { retrieveDocumentContext } from "@/lib/rag/retrieval";
import {
	buildModeratedOutputReplacement,
	buildModerationBlockResponse,
	evaluateAssistantOutputModeration,
	isBlockingModerationDecision,
	moderateUserMessage,
	recordAbuseSignal,
	recordModerationEvent,
	shouldPersistModerationDecision,
} from "@/lib/moderation/moderation-service";
import { NextResponse } from "next/server";

export interface ChatRateLimitState {
	remaining: number;
	resetAt: Date;
}

interface ChatServicePrismaClient extends MessageHistoryPrismaClient {
	conversation: {
		findFirst(_args: {
			where: { id: string; userId: string };
			include: {
				messages: {
					orderBy: { createdAt: "asc" };
					select: { role: true; content: true };
				};
			};
		}): Promise<{ id: string } | null>;
		create(_args: {
			data: { title: string; userId: string };
			include: { messages: true };
		}): Promise<{ id: string }>;
		update(_args: {
			where: { id: string };
			data: { updatedAt: Date };
		}): Promise<unknown>;
	};
	message: {
		findMany(_args: {
			where: { conversationId: string };
			orderBy: { createdAt: "asc" };
			select: { role: true; content: true };
		}): Promise<Array<{ role: string; content: string }>>;
		findFirst(_args: any): Promise<any>;
		create(_args: any): Promise<{ id: string }>;
		updateMany(_args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	generation: {
		create(_args: {
			data: Record<string, unknown>;
			select?: { id: true };
		}): Promise<{ id: string }>;
		updateMany(_args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	conversationSummary?: {
		findFirst(_args: {
			where: { conversationId: string; userId: string };
			orderBy: { createdAt: "desc" };
			select: { id: true; content: true };
		}): Promise<{ id: string; content: string } | null>;
	};
	toolExecution?: {
		updateMany(_args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
}

export interface CreateChatStreamResponseInput {
	userId: string | null;
	isGuest: boolean;
	message: string;
	model: string;
	providerName: string;
	provider: ModelProvider;
	conversationId?: string | null;
	parentMessageId?: string | null;
	retryAssistantMessageId?: string | null;
	ragFileIds?: string[];
	attachments?: AttachmentRequestInput[];
	history?: ConversationMessage[];
	appSystemPrompt: string;
	userCustomInstructions: string;
	modelCapabilities?: ModelCapabilities;
	activeSkills?: SkillActivationInput[];
	enabledTools?: Array<"web.search">;
	streamIdempotency: ActiveIdempotencyRecord;
	rateLimit: ChatRateLimitState | null;
	traceId: string;
	prismaClient?: ChatServicePrismaClient;
}

interface PreparedAuthenticatedChat {
	conversation: { id: string };
	isNewConversation: boolean;
	userMessage: { id: string };
	generationAttempt: GenerationAttempt;
	context: ChatContextBuildResult;
	tokenBudgetCheck: TokenBudgetCheckResult;
	skillTrace: ActiveSkillTrace;
}

async function completeJsonIdempotency(
	record: ActiveIdempotencyRecord,
	body: unknown,
	status: number
) {
	const jsonBody = JSON.parse(JSON.stringify(body)) as JsonValue;
	await record.complete(jsonBody, { status });
	return NextResponse.json(jsonBody, { status });
}

function buildConversationTitle(message: string): string {
	return message.slice(0, 100) + (message.length > 100 ? "..." : "");
}

function getInputModelCapabilities(input: CreateChatStreamResponseInput) {
	return input.modelCapabilities ?? DEFAULT_MODEL_CAPABILITIES;
}

async function applyAttachmentContext({
	context,
	attachments,
	providerName,
	model,
}: {
	context: ChatContextBuildResult;
	attachments: PreparedMessageAttachment[];
	providerName: string;
	model: string;
}) {
	const imageParts = await buildVisionContentParts(attachments);
	if (imageParts.length === 0) {
		return context;
	}
	const providerMessages = applyVisionAttachmentsToLastUserMessage({
		messages: context.providerMessages,
		imageParts,
	});

	return {
		...context,
		providerMessages,
		metadata: {
			...context.metadata,
			estimatedInputTokens: estimateInputTokens({
				messages: providerMessages,
				provider: providerName,
				model,
			}),
		},
	};
}

async function runEnabledToolContext({
	enabledTools,
	userId,
	conversationId,
	message,
	prismaClient,
}: {
	enabledTools: Array<"web.search"> | undefined;
	userId: string;
	conversationId: string;
	message: string;
	prismaClient: ChatServicePrismaClient;
}) {
	if (!enabledTools?.includes("web.search")) {
		return [];
	}

	const result = await proposeToolExecution(
		{
			toolName: "web.search",
			input: {
				query: message,
				maxResults: 5,
			},
			context: {
				userId,
				conversationId,
			},
		},
		{ prismaClient: prismaClient as any }
	);

	if (!result.ok) {
		return result;
	}

	return [
		{
			executionId: result.execution.id,
			toolName: result.execution.toolName,
			resultSummaryJson: result.execution.resultSummaryJson,
		},
	];
}

function buildAttachmentValidationResponse(
	record: ActiveIdempotencyRecord,
	error: AttachmentValidationError
) {
	logServerWarning("chat/stream", "attachment_validation_failed", {
		errorCode: error.errorCode,
		status: error.status,
	});

	return completeJsonIdempotency(
		record,
		{
			error: error.message,
			errorCode: error.errorCode,
		},
		error.status
	);
}

async function loadLatestConversationSummary({
	prismaClient,
	conversationId,
	userId,
}: {
	prismaClient: ChatServicePrismaClient;
	conversationId: string;
	userId: string;
}) {
	if (!prismaClient.conversationSummary) {
		return null;
	}

	return prismaClient.conversationSummary.findFirst({
		where: {
			conversationId,
			userId,
		},
		orderBy: { createdAt: "desc" },
		select: { id: true, content: true },
	});
}

function buildGenerationPromptMetadata(
	metadata: ChatContextMetadata,
	skillTrace?: ActiveSkillTrace
) {
	const activeSkillTraceJson =
		skillTrace && skillTrace.items.length > 0
			? stripSkillTraceForStorage(skillTrace)
			: undefined;

	return {
		promptVersion: metadata.promptVersion,
		contextSummaryId: metadata.summaryId,
		contextEstimatedTokens: metadata.estimatedInputTokens,
		contextRecentMessageCount:
			metadata.contextComponentCounts.recentMessages,
		contextTotalMessageCount:
			metadata.contextComponentCounts.totalHistoryMessages,
		ragContextChunkIds:
			metadata.ragContextChunkIds.length > 0
				? JSON.stringify(metadata.ragContextChunkIds)
				: null,
		ragCitationData:
			metadata.ragCitations.length > 0
				? JSON.stringify(metadata.ragCitations)
				: null,
		activeSkillTraceJson,
		promptSkillHash:
			skillTrace && skillTrace.items.length > 0
				? skillTrace.renderHash
				: metadata.skillContextHash,
	};
}

function logPromptContextMetadata(metadata: ChatContextMetadata) {
	logServerInfo("chat/stream", "context_built", {
		promptVersion: metadata.promptVersion,
		estimatedInputTokens: metadata.estimatedInputTokens,
		maxInputTokens: metadata.maxInputTokens,
		systemMessageCount: metadata.contextComponentCounts.systemMessages,
		summaryMessageCount: metadata.contextComponentCounts.summaryMessages,
		recentMessageCount: metadata.contextComponentCounts.recentMessages,
		totalHistoryMessageCount:
			metadata.contextComponentCounts.totalHistoryMessages,
		droppedHistoryMessageCount:
			metadata.contextComponentCounts.droppedHistoryMessages,
		retrievedDocumentChunkCount:
			metadata.contextComponentCounts.retrievedDocumentChunks,
		activeSkillCount: metadata.contextComponentCounts.activeSkillCount,
		totalProviderMessageCount:
			metadata.contextComponentCounts.totalProviderMessages,
	});
}

function buildChatSkillContext(skillTrace: ActiveSkillTrace) {
	const renderedContext = renderActiveSkillContext(skillTrace);
	if (!renderedContext) {
		return null;
	}

	return {
		renderedContext,
		renderHash: skillTrace.renderHash,
		installedSkillIds: skillTrace.items.map(
			(item) => item.installedSkillId
		),
		templateVersionIds: skillTrace.items.map(
			(item) => `${item.templateId}@${item.versionId}`
		),
	};
}

function emptySkillTrace(): ActiveSkillTrace {
	return {
		items: [],
		renderHash:
			"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e6e2d0aa0f2b3c0c8f5f55a",
	};
}

async function loadRagContext({
	userId,
	message,
	ragFileIds,
	prismaClient,
	traceId,
	conversationId,
}: {
	userId: string;
	message: string;
	ragFileIds: string[] | undefined;
	prismaClient: ChatServicePrismaClient;
	traceId: string;
	conversationId?: string | null;
}) {
	const fileIds = [...new Set((ragFileIds ?? []).filter(Boolean))];
	if (fileIds.length === 0) {
		return [];
	}

	const startedAt = Date.now();
	const chunks = await retrieveDocumentContext({
		userId,
		query: message,
		fileIds,
		prismaClient,
	});
	await recordOperationalMetric({
		kind: "rag_retrieval",
		source: "chat_context",
		status: "success",
		route: "/api/chat/stream",
		durationMs: Date.now() - startedAt,
		userId,
		conversationId: conversationId ?? null,
		traceId,
		metadata: {
			requestedFileCount: fileIds.length,
			selectedChunkCount: chunks.length,
			selectedChunkIds: chunks.map((chunk) => chunk.chunkId),
		},
	});
	return chunks;
}

function buildPromptBudgetExceededResponse(
	record: ActiveIdempotencyRecord,
	error: PromptInputBudgetExceededError
) {
	logServerWarning("chat/stream", "input_budget_blocked", {
		promptVersion: error.promptVersion,
		estimatedInputTokens: error.estimatedInputTokens,
		maxInputTokens: error.maxInputTokens,
	});

	return completeJsonIdempotency(
		record,
		{
			error: "Conversation context is too large for the selected model.",
			errorCode: "PROMPT_INPUT_BUDGET_EXCEEDED",
			promptVersion: error.promptVersion,
			estimatedInputTokens: error.estimatedInputTokens,
			maxInputTokens: error.maxInputTokens,
		},
		413
	);
}

async function maybeEnqueueConversationSummary({
	conversationId,
	userId,
	metadata,
}: {
	conversationId: string;
	userId: string;
	metadata: ChatContextMetadata;
}) {
	if (!metadata.summaryRecommended) {
		return;
	}

	try {
		const job = await enqueueConversationSummaryJob({
			conversationId,
			userId,
		});
		logServerInfo("chat/stream", "summary_queued", {
			jobId: String(job.id ?? ""),
			conversationId,
			promptVersion: metadata.promptVersion,
			totalHistoryMessageCount:
				metadata.contextComponentCounts.totalHistoryMessages,
			droppedHistoryMessageCount:
				metadata.contextComponentCounts.droppedHistoryMessages,
		});
	} catch (error) {
		logServerWarning("chat/stream", "summary_queue_failed", {
			conversationId,
			promptVersion: metadata.promptVersion,
			errorType: error instanceof Error ? error.name : typeof error,
		});
	}
}

async function prepareAuthenticatedChat(
	input: CreateChatStreamResponseInput & { userId: string }
): Promise<PreparedAuthenticatedChat | Response> {
	const prismaClient =
		input.prismaClient ?? (prisma as unknown as ChatServicePrismaClient);
	let conversation: { id: string } | null = null;
	let isNewConversation = false;
	let preparedAttachments: PreparedMessageAttachment[] | null = null;

	if (input.conversationId) {
		conversation = await prismaClient.conversation.findFirst({
			where: {
				id: input.conversationId,
				userId: input.userId,
			},
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
					select: {
						role: true,
						content: true,
					},
				},
			},
		});

		if (!conversation) {
			return completeJsonIdempotency(
				input.streamIdempotency,
				{ error: "Conversation not found" },
				404
			);
		}
	} else {
		try {
			preparedAttachments = await prepareMessageAttachments({
				userId: input.userId,
				modelCapabilities: getInputModelCapabilities(input),
				attachments: input.attachments,
				ragFileIds: input.ragFileIds,
				prismaClient,
			});
		} catch (error) {
			if (error instanceof AttachmentValidationError) {
				return buildAttachmentValidationResponse(
					input.streamIdempotency,
					error
				);
			}
			throw error;
		}
		conversation = await prismaClient.conversation.create({
			data: {
				title: buildConversationTitle(input.message),
				userId: input.userId,
			},
			include: {
				messages: true,
			},
		});
		isNewConversation = true;
	}

	if (!preparedAttachments) {
		try {
			preparedAttachments = await prepareMessageAttachments({
				userId: input.userId,
				modelCapabilities: getInputModelCapabilities(input),
				attachments: input.attachments,
				ragFileIds: input.ragFileIds,
				prismaClient,
			});
		} catch (error) {
			if (error instanceof AttachmentValidationError) {
				return buildAttachmentValidationResponse(
					input.streamIdempotency,
					error
				);
			}
			throw error;
		}
	}
	const attachmentsForMessage = preparedAttachments;
	const messageHistory = await loadMessageHistory({
		conversationId: conversation.id,
		parentMessageId: input.parentMessageId,
		prismaClient,
	});
	const requestHistory: ConversationMessage[] = [
		...messageHistory,
		{ role: "user", content: input.message },
	];
	const ragAttachmentFileIds = getRagFileIdsFromAttachments(
		attachmentsForMessage
	);
	const ragContext = await loadRagContext({
		userId: input.userId,
		message: input.message,
		ragFileIds: ragAttachmentFileIds,
		prismaClient,
		traceId: input.traceId,
		conversationId: conversation.id,
	});
	const toolResults = await runEnabledToolContext({
		enabledTools: input.enabledTools,
		userId: input.userId,
		conversationId: conversation.id,
		message: input.message,
		prismaClient,
	});
	if (!Array.isArray(toolResults)) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: toolResults.error,
				errorCode: toolResults.errorCode,
			},
			toolResults.status
		);
	}
	const skillTrace = await resolveActiveSkillTrace({
		userId: input.userId,
		conversationId: conversation.id,
		activeSkills: input.activeSkills,
		prismaClient: prismaClient as any,
	});
	let context: ChatContextBuildResult;
	try {
		context = buildChatContext({
			appSystemPrompt: input.appSystemPrompt,
			userCustomInstructions: input.userCustomInstructions,
			messageHistory: requestHistory,
			conversationSummary: await loadLatestConversationSummary({
				prismaClient,
				conversationId: conversation.id,
				userId: input.userId,
			}),
			ragContext,
			toolResults,
			skillContext: buildChatSkillContext(skillTrace),
			providerName: input.providerName,
			model: input.model,
		});
		context = await applyAttachmentContext({
			context,
			attachments: attachmentsForMessage,
			providerName: input.providerName,
			model: input.model,
		});
	} catch (error) {
		if (error instanceof PromptInputBudgetExceededError) {
			return buildPromptBudgetExceededResponse(
				input.streamIdempotency,
				error
			);
		}
		throw error;
	}
	logPromptContextMetadata(context.metadata);
	const tokenBudgetCheck = await checkTokenBudgetBeforeRequest(
		input.userId,
		context.providerMessages
	);

	if (!tokenBudgetCheck.allowed) {
		logServerInfo("chat/stream", "token_budget_blocked", {
			planTier: tokenBudgetCheck.tier,
			usageBand: tokenBudgetCheck.usageBand,
			usagePercent: tokenBudgetCheck.usagePercent,
		});
		await recordAbuseSignal({
			prismaClient,
			signalType: "token_draining",
			severity: tokenBudgetCheck.usagePercent >= 100 ? "high" : "medium",
			action: "block",
			userId: input.userId,
			conversationId: conversation.id,
			metadata: {
				planTier: tokenBudgetCheck.tier,
				usageBand: tokenBudgetCheck.usageBand,
				usagePercent: tokenBudgetCheck.usagePercent,
			},
		});
		await recordOperationalMetric({
			kind: "quota",
			source: "chat_stream",
			status: "blocked",
			route: "/api/chat/stream",
			errorCode: "PLAN_USAGE_LIMIT_REACHED",
			userId: input.userId,
			conversationId: conversation.id,
			metadata: {
				planTier: tokenBudgetCheck.tier,
				usageBand: tokenBudgetCheck.usageBand,
				usagePercent: tokenBudgetCheck.usagePercent,
			},
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "You have reached your current plan usage limit.",
				errorCode: "PLAN_USAGE_LIMIT_REACHED",
				plan: {
					tier: tokenBudgetCheck.tier,
					usageBand: tokenBudgetCheck.usageBand,
					usagePercent: tokenBudgetCheck.usagePercent,
					trialEndsAt:
						tokenBudgetCheck.trialEndsAt?.toISOString() ?? null,
				},
			},
			429
		);
	}

	if (!isModelIncludedInPlan(tokenBudgetCheck.tier, input.model)) {
		logServerWarning("chat/stream", "model_entitlement_blocked", {
			planTier: tokenBudgetCheck.tier,
			model: input.model,
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			getModelAccessError(tokenBudgetCheck.tier, input.model),
			403
		);
	}

	const userMessage = await prismaClient.message.create({
		data: {
			role: "user",
			content: input.message,
			conversationId: conversation.id,
			parentMessageId: input.parentMessageId || null,
		},
	});
	if (
		prismaClient.toolExecution &&
		context.metadata.toolExecutionIds.length > 0
	) {
		await prismaClient.toolExecution.updateMany({
			where: {
				id: { in: context.metadata.toolExecutionIds },
				userId: input.userId,
				conversationId: conversation.id,
				messageId: null,
			},
			data: { messageId: userMessage.id },
		});
	}
	await createMessageAttachmentRows({
		prismaClient,
		messageId: userMessage.id,
		conversationId: conversation.id,
		userId: input.userId,
		attachments: attachmentsForMessage,
	});
	const generationAttempt = await createGenerationAttempt({
		prismaClient,
		userId: input.userId,
		conversationId: conversation.id,
		userMessageId: userMessage.id,
		provider: input.providerName,
		model: input.model,
		promptMetadata: buildGenerationPromptMetadata(
			context.metadata,
			skillTrace
		),
	});
	await persistSkillTraceForGeneration({
		userId: input.userId,
		conversationId: conversation.id,
		messageId: generationAttempt.assistantMessage.id,
		trace: skillTrace,
		prismaClient: prismaClient as any,
	});

	return {
		conversation,
		isNewConversation,
		userMessage,
		generationAttempt,
		context,
		tokenBudgetCheck,
		skillTrace,
	};
}

async function prepareAuthenticatedRetryChat(
	input: CreateChatStreamResponseInput & {
		userId: string;
		retryAssistantMessageId: string;
	}
): Promise<PreparedAuthenticatedChat | Response> {
	const prismaClient =
		input.prismaClient ?? (prisma as unknown as ChatServicePrismaClient);
	const targetAssistantMessage = await prismaClient.message.findFirst({
		where: {
			id: input.retryAssistantMessageId,
			role: "assistant",
			conversation: {
				userId: input.userId,
			},
		},
		select: {
			id: true,
			model: true,
			parentMessageId: true,
			conversationId: true,
		},
	});

	if (!targetAssistantMessage) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{ error: "Message not found" },
			404
		);
	}

	if (!targetAssistantMessage.parentMessageId) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "Assistant message cannot be retried because it has no user prompt.",
				errorCode: "RETRY_PARENT_MESSAGE_MISSING",
			},
			400
		);
	}

	const userMessage = await prismaClient.message.findFirst({
		where: {
			id: targetAssistantMessage.parentMessageId,
			conversationId: targetAssistantMessage.conversationId,
			role: "user",
		},
		select: {
			id: true,
			content: true,
			parentMessageId: true,
		},
	});

	if (!userMessage) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "Original user message not found",
				errorCode: "RETRY_PARENT_MESSAGE_NOT_FOUND",
			},
			404
		);
	}

	const moderationDecision = await moderateUserMessage({
		prismaClient,
		content: userMessage.content,
		userId: input.userId,
		conversationId: targetAssistantMessage.conversationId,
	});
	if (isBlockingModerationDecision(moderationDecision)) {
		const response = buildModerationBlockResponse(moderationDecision);
		return completeJsonIdempotency(
			input.streamIdempotency,
			await response.json(),
			response.status
		);
	}

	const messageHistory = userMessage.parentMessageId
		? await loadMessageHistory({
				conversationId: targetAssistantMessage.conversationId,
				parentMessageId: userMessage.parentMessageId,
				prismaClient,
			})
		: [];
	let persistedAttachments: PreparedMessageAttachment[];
	try {
		persistedAttachments = await loadPersistedMessageAttachments({
			userId: input.userId,
			messageId: userMessage.id,
			modelCapabilities: getInputModelCapabilities(input),
			prismaClient,
		});
	} catch (error) {
		if (error instanceof AttachmentValidationError) {
			return buildAttachmentValidationResponse(
				input.streamIdempotency,
				error
			);
		}
		throw error;
	}
	const requestHistory: ConversationMessage[] = [
		...messageHistory,
		{ role: "user", content: userMessage.content },
	];
	const ragAttachmentFileIds =
		getRagFileIdsFromAttachments(persistedAttachments);
	const ragContext = await loadRagContext({
		userId: input.userId,
		message: userMessage.content,
		ragFileIds: ragAttachmentFileIds,
		prismaClient,
		traceId: input.traceId,
		conversationId: targetAssistantMessage.conversationId,
	});
	let context: ChatContextBuildResult;
	try {
		context = buildChatContext({
			appSystemPrompt: input.appSystemPrompt,
			userCustomInstructions: input.userCustomInstructions,
			messageHistory: requestHistory,
			conversationSummary: await loadLatestConversationSummary({
				prismaClient,
				conversationId: targetAssistantMessage.conversationId,
				userId: input.userId,
			}),
			ragContext,
			providerName: input.providerName,
			model: input.model,
		});
		context = await applyAttachmentContext({
			context,
			attachments: persistedAttachments,
			providerName: input.providerName,
			model: input.model,
		});
	} catch (error) {
		if (error instanceof PromptInputBudgetExceededError) {
			return buildPromptBudgetExceededResponse(
				input.streamIdempotency,
				error
			);
		}
		throw error;
	}
	logPromptContextMetadata(context.metadata);
	const tokenBudgetCheck = await checkTokenBudgetBeforeRequest(
		input.userId,
		context.providerMessages
	);

	if (!tokenBudgetCheck.allowed) {
		await recordAbuseSignal({
			prismaClient,
			signalType: "token_draining",
			severity: tokenBudgetCheck.usagePercent >= 100 ? "high" : "medium",
			action: "block",
			userId: input.userId,
			conversationId: targetAssistantMessage.conversationId,
			metadata: {
				planTier: tokenBudgetCheck.tier,
				usageBand: tokenBudgetCheck.usageBand,
				usagePercent: tokenBudgetCheck.usagePercent,
				flow: "retry",
			},
		});
		await recordOperationalMetric({
			kind: "quota",
			source: "message_retry",
			status: "blocked",
			route: "/api/messages/[id]/retry",
			errorCode: "PLAN_USAGE_LIMIT_REACHED",
			userId: input.userId,
			conversationId: targetAssistantMessage.conversationId,
			metadata: {
				planTier: tokenBudgetCheck.tier,
				usageBand: tokenBudgetCheck.usageBand,
				usagePercent: tokenBudgetCheck.usagePercent,
			},
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "You have reached your current plan usage limit.",
				errorCode: "PLAN_USAGE_LIMIT_REACHED",
				plan: {
					tier: tokenBudgetCheck.tier,
					usageBand: tokenBudgetCheck.usageBand,
					usagePercent: tokenBudgetCheck.usagePercent,
					trialEndsAt:
						tokenBudgetCheck.trialEndsAt?.toISOString() ?? null,
				},
			},
			429
		);
	}

	if (!isModelIncludedInPlan(tokenBudgetCheck.tier, input.model)) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			getModelAccessError(tokenBudgetCheck.tier, input.model),
			403
		);
	}

	const generationAttempt = await createGenerationAttempt({
		prismaClient,
		userId: input.userId,
		conversationId: targetAssistantMessage.conversationId,
		userMessageId: userMessage.id,
		provider: input.providerName,
		model: input.model,
		promptMetadata: buildGenerationPromptMetadata(context.metadata),
	});

	return {
		conversation: { id: targetAssistantMessage.conversationId },
		isNewConversation: false,
		userMessage: { id: userMessage.id },
		generationAttempt,
		context,
		tokenBudgetCheck,
		skillTrace: emptySkillTrace(),
	};
}

async function prepareGuestChat(
	input: CreateChatStreamResponseInput
): Promise<{ context: ChatContextBuildResult } | Response> {
	if (!isModelIncludedInPlan("guest", input.model)) {
		logServerWarning("chat/stream", "model_entitlement_blocked", {
			planTier: "guest",
			model: input.model,
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			getModelAccessError("guest", input.model),
			403
		);
	}

	const messageHistory = buildGuestMessageHistory(
		input.history,
		input.message
	);
	let context: ChatContextBuildResult;

	try {
		context = buildChatContext({
			appSystemPrompt: input.appSystemPrompt,
			userCustomInstructions: input.userCustomInstructions,
			messageHistory,
			providerName: input.providerName,
			model: input.model,
		});
	} catch (error) {
		if (error instanceof PromptInputBudgetExceededError) {
			return buildPromptBudgetExceededResponse(
				input.streamIdempotency,
				error
			);
		}
		throw error;
	}
	logPromptContextMetadata(context.metadata);

	return {
		context,
	};
}

function buildStreamHeaders(
	tokenBudgetCheck: TokenBudgetCheckResult | null,
	rateLimit: ChatRateLimitState | null,
	traceId: string,
	generationId: string
) {
	return {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Plan-Tier": tokenBudgetCheck?.tier ?? "guest",
		"X-Plan-Usage": tokenBudgetCheck?.usageBand ?? "unknown",
		"X-RateLimit-Remaining": String(rateLimit?.remaining || 0),
		"X-RateLimit-Reset":
			rateLimit?.resetAt?.toISOString() || new Date().toISOString(),
		"X-Trace-Id": traceId,
		"X-Generation-Id": generationId,
	};
}

export async function createChatStreamResponse(
	input: CreateChatStreamResponseInput
): Promise<Response> {
	const prismaClient =
		input.prismaClient ?? (prisma as unknown as ChatServicePrismaClient);
	let conversation: { id: string } | null = null;
	let isNewConversation = false;
	let userMessage: { id: string } | null = null;
	let generationAttempt: GenerationAttempt | null = null;
	let tokenBudgetCheck: TokenBudgetCheckResult | null = null;
	let skillTrace: ActiveSkillTrace = emptySkillTrace();
	let context: ChatContextBuildResult;

	if (!input.isGuest) {
		if (!input.userId) {
			return completeJsonIdempotency(
				input.streamIdempotency,
				{ error: "Internal server error" },
				500
			);
		}

		const prepared = input.retryAssistantMessageId
			? await prepareAuthenticatedRetryChat({
					...input,
					userId: input.userId,
					retryAssistantMessageId: input.retryAssistantMessageId,
					prismaClient,
				})
			: await prepareAuthenticatedChat({
					...input,
					userId: input.userId,
					prismaClient,
				});

		if (prepared instanceof Response) {
			return prepared;
		}

		conversation = prepared.conversation;
		isNewConversation = prepared.isNewConversation;
		userMessage = prepared.userMessage;
		generationAttempt = prepared.generationAttempt;
		context = prepared.context;
		tokenBudgetCheck = prepared.tokenBudgetCheck;
		skillTrace = prepared.skillTrace;
	} else {
		const prepared = await prepareGuestChat(input);

		if (prepared instanceof Response) {
			return prepared;
		}

		context = prepared.context;
	}

	const encoder = new TextEncoder();
	const generationId =
		generationAttempt?.generation.id ?? crypto.randomUUID();
	const generationStartedAt = Date.now();
	let firstTokenAt: number | null = null;
	let retryCount = 0;
	let fallbackCount = 0;
	let attemptedModel = input.model;
	let fullResponse = "";
	let providerOutputForUsage = "";
	let providerUsage: ModelUsage | undefined;
	let providerRequestId: string | undefined;
	let resolvedModel: string | undefined;
	let outputModerationDecision: ReturnType<
		typeof evaluateAssistantOutputModeration
	> | null = null;
	let lastFlushAt = 0;
	let lastFlushLength = 0;
	const guestUsageDeduplicationKey = input.isGuest
		? `guest-chat:${input.streamIdempotency.id}`
		: null;
	let guestUsageAttemptCreated = false;

	const readableStream = new ReadableStream({
		async start(controller) {
			const abortController =
				!input.isGuest && generationAttempt
					? new AbortController()
					: null;

			try {
				if (!input.isGuest && isNewConversation && conversation) {
					enqueueSseEvent(controller, encoder, {
						type: "conversation",
						conversationId: conversation.id,
					});
				}

				if (!input.isGuest && userMessage) {
					enqueueSseEvent(controller, encoder, {
						type: "messageId",
						userMessageId: userMessage.id,
						assistantMessageId:
							generationAttempt?.assistantMessage.id,
						generationId: generationAttempt?.generation.id,
						...(skillTrace.items.length > 0
							? {
									activeSkillTrace:
										stripSkillTraceForStorage(skillTrace),
								}
							: {}),
					});
				}

				if (
					!input.isGuest &&
					context.metadata.ragCitations.length > 0
				) {
					enqueueSseEvent(controller, encoder, {
						type: "citations",
						citations: context.metadata.ragCitations,
					});
				}

				if (abortController && generationAttempt) {
					registerGenerationAbortController(
						generationAttempt.generation.id,
						abortController
					);
				}

				if (guestUsageDeduplicationKey) {
					await createUsageAttempt({
						prismaClient,
						deduplicationKey: guestUsageDeduplicationKey,
						feature: "chat_response",
						provider: input.providerName,
						requestedModel: input.model,
						promptVersion: context.metadata.promptVersion,
					});
					guestUsageAttemptCreated = true;
				}

				const planTier =
					tokenBudgetCheck?.tier ??
					(input.isGuest ? "guest" : "free");
				const fallbackModels = getModelFallbackCandidates({
					model: input.model,
					tier: planTier,
					requiredCapabilities: getInputModelCapabilities(input),
				});
				const stream = resilientModelStream({
					providerName: input.providerName,
					provider: input.provider,
					primaryModel: input.model,
					fallbackModels,
					request: {
						messages: context.providerMessages,
						signal: abortController?.signal,
					},
					onAttempt: async (attempt) => {
						retryCount = Math.max(retryCount, attempt.retryCount);
						fallbackCount = Math.max(
							fallbackCount,
							attempt.fallbackCount
						);
						attemptedModel = attempt.model;
						if (
							attempt.status === "failed" ||
							attempt.status === "retrying" ||
							attempt.status === "circuit_open"
						) {
							await recordOperationalMetric({
								kind: "ai_provider_attempt",
								source: "chat_response",
								status: attempt.status,
								route: "/api/chat/stream",
								provider: attempt.provider,
								model: attempt.model,
								errorCode: attempt.errorCode,
								providerStatus: attempt.providerStatusCode,
								userId: input.userId,
								conversationId: conversation?.id ?? null,
								traceId: input.traceId,
								metadata: {
									generationId,
									attempt: attempt.attempt,
									retryCount: attempt.retryCount,
									fallbackCount: attempt.fallbackCount,
									delayMs: attempt.delayMs ?? null,
									planTier,
								},
							});
						}
					},
				});

				for await (const chunk of stream) {
					retryCount = Math.max(retryCount, chunk.retryCount ?? 0);
					fallbackCount = Math.max(
						fallbackCount,
						chunk.fallbackCount ?? 0
					);
					attemptedModel = chunk.requestedModel ?? attemptedModel;
					if (chunk.content) {
						firstTokenAt ??= Date.now();
						const candidateResponse = fullResponse + chunk.content;
						const candidateModerationDecision =
							evaluateAssistantOutputModeration(
								candidateResponse
							);
						providerOutputForUsage = candidateResponse;

						if (
							isBlockingModerationDecision(
								candidateModerationDecision
							)
						) {
							outputModerationDecision =
								candidateModerationDecision;
							abortController?.abort();
							break;
						}

						if (
							candidateModerationDecision.action !== "allow" &&
							!outputModerationDecision
						) {
							outputModerationDecision =
								candidateModerationDecision;
						}

						fullResponse = candidateResponse;
						enqueueSseEvent(controller, encoder, {
							type: "content",
							content: chunk.content,
						});

						if (
							!input.isGuest &&
							generationAttempt &&
							(Date.now() - lastFlushAt >= 1000 ||
								fullResponse.length - lastFlushLength >= 1000)
						) {
							await flushGenerationContent({
								prismaClient,
								assistantMessageId:
									generationAttempt.assistantMessage.id,
								generationId: generationAttempt.generation.id,
								content: fullResponse,
							});
							lastFlushAt = Date.now();
							lastFlushLength = fullResponse.length;
						}
					}

					if (chunk.usage) {
						providerUsage = chunk.usage;
					}
					providerRequestId =
						chunk.providerRequestId ?? providerRequestId;
					resolvedModel = chunk.resolvedModel ?? resolvedModel;
				}

				const finalModerationDecision =
					outputModerationDecision ??
					evaluateAssistantOutputModeration(fullResponse);
				const outputForUsage = providerOutputForUsage || fullResponse;

				const usage = buildUsageMeasurement({
					requestedModel: input.model,
					resolvedModel,
					providerRequestId,
					providerUsage,
					estimatedInputTokens: context.metadata.estimatedInputTokens,
					estimatedOutputTokens: estimateOutputTokens({
						content: outputForUsage,
						provider: input.providerName,
						model: input.model,
					}),
					outcome: isBlockingModerationDecision(
						finalModerationDecision
					)
						? "moderated"
						: "completed",
				});

				if (shouldPersistModerationDecision(finalModerationDecision)) {
					await recordModerationEvent({
						prismaClient,
						decision: finalModerationDecision,
						source: "assistant_output",
						stage: "post_generation",
						content: outputForUsage,
						userId: input.userId,
						conversationId: conversation?.id ?? null,
						messageId:
							generationAttempt?.assistantMessage.id ?? null,
						metadata: {
							provider: input.providerName,
							requestedModel: input.model,
							resolvedModel,
						},
					});
				}

				if (isBlockingModerationDecision(finalModerationDecision)) {
					const replacementContent = buildModeratedOutputReplacement(
						finalModerationDecision
					);

					if (guestUsageDeduplicationKey) {
						await finalizeUsageEvent({
							prismaClient,
							deduplicationKey: guestUsageDeduplicationKey,
							outcome: "moderated",
							measurement: usage,
							errorCode: "OUTPUT_MODERATED",
						});
					}

					if (
						!input.isGuest &&
						conversation &&
						userMessage &&
						generationAttempt
					) {
						await moderateGeneration({
							prismaClient,
							assistantMessageId:
								generationAttempt.assistantMessage.id,
							generationId: generationAttempt.generation.id,
							content: replacementContent,
							errorCode: "OUTPUT_MODERATED",
							usage,
						});
					}

					await input.streamIdempotency.fail(
						toJsonValue({
							kind: "chat_stream_error",
							conversationId: conversation?.id ?? null,
							userMessageId: userMessage?.id ?? null,
							assistantMessageId:
								generationAttempt?.assistantMessage.id ?? null,
							generationId:
								generationAttempt?.generation.id ?? null,
							error: finalModerationDecision.userMessage,
							errorCode: "OUTPUT_MODERATED",
							partialContent: Boolean(fullResponse),
							content: replacementContent,
							replacementContent,
						} satisfies ChatStreamErrorReplayBody),
						{
							status: 200,
							resourceType: generationAttempt
								? "message"
								: undefined,
							resourceId: generationAttempt?.assistantMessage.id,
						}
					);
					enqueueSseEvent(controller, encoder, {
						type: "error",
						error: finalModerationDecision.userMessage,
						errorCode: "OUTPUT_MODERATED",
						partialContent: Boolean(fullResponse),
						replacementContent,
					});
					await recordOperationalMetric({
						kind: "ai_generation",
						source: "chat_response",
						status: "moderated",
						route: "/api/chat/stream",
						provider: input.providerName,
						model: attemptedModel,
						durationMs: Date.now() - generationStartedAt,
						ttftMs: firstTokenAt
							? firstTokenAt - generationStartedAt
							: null,
						totalTokens: usage.billableUnits,
						costTotal: usage.estimatedCostUsd
							? Number(usage.estimatedCostUsd)
							: null,
						errorCode: "OUTPUT_MODERATED",
						userId: input.userId,
						conversationId: conversation?.id ?? null,
						traceId: input.traceId,
						metadata: {
							generationId,
							retryCount,
							fallbackCount,
							planTier,
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
						},
					});
					return;
				}

				if (guestUsageDeduplicationKey) {
					await finalizeUsageEvent({
						prismaClient,
						deduplicationKey: guestUsageDeduplicationKey,
						outcome: "completed",
						measurement: usage,
					});
				}

				if (
					!input.isGuest &&
					conversation &&
					userMessage &&
					generationAttempt
				) {
					const completed = await completeGeneration({
						prismaClient,
						assistantMessageId:
							generationAttempt.assistantMessage.id,
						generationId: generationAttempt.generation.id,
						content: fullResponse,
						usage,
					});

					await prismaClient.conversation.update({
						where: { id: conversation.id },
						data: { updatedAt: new Date() },
					});

					if (!completed) {
						await input.streamIdempotency.fail(
							toJsonValue({
								kind: "chat_stream_error",
								conversationId: conversation.id,
								userMessageId: userMessage.id,
								assistantMessageId:
									generationAttempt.assistantMessage.id,
								generationId: generationAttempt.generation.id,
								error: "Generation cancelled.",
								errorCode: "GENERATION_CANCELLED",
								partialContent: fullResponse.length > 0,
								content: fullResponse,
							} satisfies ChatStreamErrorReplayBody),
							{
								status: 200,
								resourceType: "message",
								resourceId:
									generationAttempt.assistantMessage.id,
							}
						);
						return;
					}

					await maybeEnqueueConversationSummary({
						conversationId: conversation.id,
						userId: input.userId!,
						metadata: context.metadata,
					});

					await input.streamIdempotency.complete(
						toJsonValue({
							kind: "chat_stream",
							conversationId: conversation.id,
							userMessageId: userMessage.id,
							assistantMessageId:
								generationAttempt.assistantMessage.id,
							generationId: generationAttempt.generation.id,
							content: fullResponse,
							usage: {
								promptTokens: usage.inputTokens,
								completionTokens: usage.outputTokens,
							},
							citations: context.metadata.ragCitations,
						} satisfies ChatStreamReplayBody),
						{
							status: 200,
							resourceType: "message",
							resourceId: generationAttempt.assistantMessage.id,
						}
					);

					enqueueSseEvent(controller, encoder, {
						type: "done",
						assistantMessageId:
							generationAttempt.assistantMessage.id,
						usage: {
							promptTokens: usage.inputTokens,
							completionTokens: usage.outputTokens,
						},
					});
				} else {
					await input.streamIdempotency.complete(
						toJsonValue({
							kind: "chat_stream",
							conversationId: null,
							userMessageId: null,
							assistantMessageId: null,
							content: fullResponse,
							usage: {
								promptTokens: usage.inputTokens,
								completionTokens: usage.outputTokens,
							},
						} satisfies ChatStreamReplayBody),
						{ status: 200 }
					);

					enqueueSseEvent(controller, encoder, {
						type: "done",
						usage: {
							promptTokens: usage.inputTokens,
							completionTokens: usage.outputTokens,
						},
					});
				}
				const durationMs = Math.max(
					1,
					Date.now() - generationStartedAt
				);
				await recordOperationalMetric({
					kind: "ai_generation",
					source: "chat_response",
					status: "success",
					route: "/api/chat/stream",
					provider: input.providerName,
					model: attemptedModel,
					durationMs,
					ttftMs: firstTokenAt
						? firstTokenAt - generationStartedAt
						: null,
					tokensPerSec:
						usage.outputTokens > 0
							? usage.outputTokens / (durationMs / 1000)
							: null,
					totalTokens: usage.billableUnits,
					costTotal: usage.estimatedCostUsd
						? Number(usage.estimatedCostUsd)
						: null,
					userId: input.userId,
					conversationId: conversation?.id ?? null,
					traceId: input.traceId,
					metadata: {
						generationId,
						retryCount,
						fallbackCount,
						planTier,
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
						selectedChunkIds: context.metadata.ragCitations.map(
							(citation) => citation.chunkId
						),
					},
				});
			} catch (error) {
				logServerError("chat/stream", "stream_error", error, {
					isGuest: input.isGuest,
					model: input.model,
				});

				const streamError = normalizeProviderStreamError(error);
				await recordAbuseSignal({
					prismaClient,
					signalType:
						streamError.errorCode === "PROVIDER_RATE_LIMITED" ||
						streamError.providerStatusCode === 429
							? "provider_rate_limit"
							: "high_failure_rate",
					severity:
						streamError.providerStatusCode === 429
							? "medium"
							: "high",
					action: "degrade",
					userId: input.userId,
					conversationId: conversation?.id ?? null,
					provider: input.providerName,
					model: input.model,
					providerStatusCode: streamError.providerStatusCode ?? null,
					metadata: {
						errorCode: streamError.errorCode,
						isGuest: input.isGuest,
						hasPartialOutput: Boolean(fullResponse),
					},
				});
				const usage = buildUsageMeasurement({
					requestedModel: input.model,
					resolvedModel,
					providerRequestId:
						streamError.providerRequestId ?? providerRequestId,
					providerUsage,
					estimatedInputTokens: context.metadata.estimatedInputTokens,
					estimatedOutputTokens: estimateOutputTokens({
						content: fullResponse,
						provider: input.providerName,
						model: input.model,
					}),
					outcome: "failed",
					hasPartialOutput: Boolean(fullResponse),
				});
				if (!input.isGuest && generationAttempt) {
					await failGeneration({
						prismaClient,
						assistantMessageId:
							generationAttempt.assistantMessage.id,
						generationId: generationAttempt.generation.id,
						content: fullResponse,
						error: streamError,
						usage,
					});
				} else if (
					guestUsageDeduplicationKey &&
					guestUsageAttemptCreated
				) {
					await finalizeUsageEvent({
						prismaClient,
						deduplicationKey: guestUsageDeduplicationKey,
						outcome: "failed",
						measurement: usage,
						errorCode: streamError.errorCode,
						providerStatusCode: streamError.providerStatusCode,
					});
				}
				await input.streamIdempotency.fail(
					toJsonValue({
						kind: "chat_stream_error",
						conversationId: conversation?.id ?? null,
						userMessageId: userMessage?.id ?? null,
						assistantMessageId:
							generationAttempt?.assistantMessage.id ?? null,
						generationId: generationAttempt?.generation.id ?? null,
						error: streamError.message,
						errorCode: streamError.errorCode,
						providerStatusCode: streamError.providerStatusCode,
						retryAfterSeconds: streamError.retryAfterSeconds,
						providerRequestId: streamError.providerRequestId,
						partialContent: fullResponse.length > 0,
						content: fullResponse,
					} satisfies ChatStreamErrorReplayBody),
					{ status: 200 }
				);
				enqueueSseEvent(controller, encoder, {
					type: "error",
					error: streamError.message,
					errorCode: streamError.errorCode,
					providerStatusCode: streamError.providerStatusCode,
					retryAfterSeconds: streamError.retryAfterSeconds,
					providerRequestId: streamError.providerRequestId,
					partialContent: fullResponse.length > 0,
					traceId: input.traceId,
					generationId,
				});
				await recordOperationalMetric({
					kind: "ai_generation",
					source: "chat_response",
					status: "failed",
					route: "/api/chat/stream",
					provider: input.providerName,
					model: attemptedModel,
					durationMs: Date.now() - generationStartedAt,
					ttftMs: firstTokenAt
						? firstTokenAt - generationStartedAt
						: null,
					errorCode: streamError.errorCode,
					providerStatus: streamError.providerStatusCode,
					userId: input.userId,
					conversationId: conversation?.id ?? null,
					traceId: input.traceId,
					metadata: {
						generationId,
						retryCount,
						fallbackCount,
						planTier:
							tokenBudgetCheck?.tier ??
							(input.isGuest ? "guest" : "free"),
						streamInterrupted: fullResponse.length > 0,
					},
				});
			} finally {
				if (generationAttempt) {
					unregisterGenerationAbortController(
						generationAttempt.generation.id
					);
				}
				controller.close();
			}
		},
	});

	return new Response(readableStream, {
		headers: buildStreamHeaders(
			tokenBudgetCheck,
			input.rateLimit,
			input.traceId,
			generationId
		),
	});
}
