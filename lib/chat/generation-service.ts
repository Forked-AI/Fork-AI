import type { NormalizedStreamError } from "@/lib/ai/errors";
import { prisma } from "@/lib/prisma";
import { abortRegisteredGeneration } from "@/lib/chat/generation-abort-registry";
import {
	buildUsageMeasurement,
	createUsageAttempt,
	estimateOutputTokens,
	finalizeUsageEventInTransaction,
	type UsageMeasurement,
} from "@/lib/usage/usage-service";

export type DurableMessageStatus =
	| "pending"
	| "streaming"
	| "completed"
	| "failed"
	| "cancelled"
	| "moderated";

export type DurableGenerationStatus = DurableMessageStatus;

const ACTIVE_STATUSES: DurableMessageStatus[] = ["pending", "streaming"];
const TERMINAL_STATUSES: DurableMessageStatus[] = [
	"completed",
	"failed",
	"cancelled",
	"moderated",
];

const DEFAULT_STALE_TIMEOUT_MS = 2 * 60 * 1000;

export function getGenerationStaleTimeoutMs() {
	const configured = Number(process.env.CHAT_GENERATION_STALE_TIMEOUT_MS);
	return Number.isFinite(configured) && configured > 0
		? configured
		: DEFAULT_STALE_TIMEOUT_MS;
}

type GenerationPrismaClient = any;

export interface CreateGenerationAttemptInput {
	prismaClient?: GenerationPrismaClient;
	userId: string;
	conversationId: string;
	userMessageId: string;
	provider: string;
	model: string;
	promptMetadata?: {
		promptVersion: string;
		contextSummaryId: string | null;
		contextEstimatedTokens: number;
		contextRecentMessageCount: number;
		contextTotalMessageCount: number;
		ragContextChunkIds?: string | null;
		ragCitationData?: string | null;
		activeSkillTraceJson?: unknown;
		promptSkillHash?: string | null;
	};
}

export interface GenerationAttempt {
	assistantMessage: { id: string };
	generation: { id: string };
}

export async function createGenerationAttempt({
	prismaClient = prisma,
	userId,
	conversationId,
	userMessageId,
	provider,
	model,
	promptMetadata,
}: CreateGenerationAttemptInput): Promise<GenerationAttempt> {
	const now = new Date();

	return prismaClient.$transaction(
		async (transaction: GenerationPrismaClient) => {
			const assistantMessage = await transaction.message.create({
				data: {
					role: "assistant",
					content: "",
					model,
					conversationId,
					parentMessageId: userMessageId,
					isError: false,
					status: "streaming",
					startedAt: now,
					lastChunkAt: now,
					promptVersion: promptMetadata?.promptVersion,
					contextSummaryId: promptMetadata?.contextSummaryId ?? null,
					contextEstimatedTokens:
						promptMetadata?.contextEstimatedTokens,
					contextRecentMessageCount:
						promptMetadata?.contextRecentMessageCount,
					contextTotalMessageCount:
						promptMetadata?.contextTotalMessageCount,
					ragContextChunkIds:
						promptMetadata?.ragContextChunkIds ?? null,
					ragCitationData: promptMetadata?.ragCitationData ?? null,
					activeSkillTraceJson:
						promptMetadata?.activeSkillTraceJson ?? undefined,
					promptSkillHash: promptMetadata?.promptSkillHash ?? null,
				},
				select: { id: true },
			});

			const generation = await transaction.generation.create({
				data: {
					userId,
					conversationId,
					userMessageId,
					assistantMessageId: assistantMessage.id,
					provider,
					model,
					status: "streaming",
					startedAt: now,
					lastChunkAt: now,
					promptVersion: promptMetadata?.promptVersion,
					contextSummaryId: promptMetadata?.contextSummaryId ?? null,
					contextEstimatedTokens:
						promptMetadata?.contextEstimatedTokens,
					contextRecentMessageCount:
						promptMetadata?.contextRecentMessageCount,
					contextTotalMessageCount:
						promptMetadata?.contextTotalMessageCount,
					ragContextChunkIds:
						promptMetadata?.ragContextChunkIds ?? null,
					ragCitationData: promptMetadata?.ragCitationData ?? null,
					activeSkillTraceJson:
						promptMetadata?.activeSkillTraceJson ?? undefined,
					promptSkillHash: promptMetadata?.promptSkillHash ?? null,
				},
				select: { id: true },
			});

			await createUsageAttempt({
				prismaClient: transaction,
				deduplicationKey: `generation:${generation.id}`,
				userId,
				conversationId,
				messageId: assistantMessage.id,
				generationId: generation.id,
				feature: "chat_response",
				provider,
				requestedModel: model,
				promptVersion: promptMetadata?.promptVersion,
				startedAt: now,
			});

			return { assistantMessage, generation };
		}
	);
}

export async function flushGenerationContent({
	prismaClient = prisma,
	assistantMessageId,
	generationId,
	content,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	generationId: string;
	content: string;
	now?: Date;
}) {
	await Promise.all([
		prismaClient.message.updateMany({
			where: {
				id: assistantMessageId,
				status: { in: ACTIVE_STATUSES },
			},
			data: {
				content,
				status: "streaming",
				lastChunkAt: now,
			},
		}),
		prismaClient.generation.updateMany({
			where: {
				id: generationId,
				status: { in: ACTIVE_STATUSES },
			},
			data: {
				status: "streaming",
				lastChunkAt: now,
			},
		}),
	]);
}

export async function completeGeneration({
	prismaClient = prisma,
	assistantMessageId,
	generationId,
	content,
	usage,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	generationId: string;
	content: string;
	usage: UsageMeasurement;
	now?: Date;
}) {
	return prismaClient.$transaction(
		async (transaction: GenerationPrismaClient) => {
			const messageResult = await transaction.message.updateMany({
				where: {
					id: assistantMessageId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					content,
					status: "completed",
					isError: false,
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					errorCode: null,
					providerStatusCode: null,
					providerRequestId: usage.providerRequestId,
					completedAt: now,
					lastChunkAt: now,
				},
			});

			if (messageResult.count !== 1) {
				return false;
			}

			const generationResult = await transaction.generation.updateMany({
				where: {
					id: generationId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					status: "completed",
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					errorCode: null,
					providerStatusCode: null,
					providerRequestId: usage.providerRequestId,
					completedAt: now,
					lastChunkAt: now,
				},
			});

			if (generationResult.count !== 1) {
				throw new Error("Generation state changed during completion");
			}

			await finalizeUsageEventInTransaction({
				prismaClient: transaction,
				deduplicationKey: `generation:${generationId}`,
				outcome: "completed",
				measurement: usage,
				finalizedAt: now,
			});

			return true;
		}
	);
}

export async function failGeneration({
	prismaClient = prisma,
	assistantMessageId,
	generationId,
	content,
	error,
	usage,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	generationId: string;
	content: string;
	error: NormalizedStreamError;
	usage: UsageMeasurement;
	now?: Date;
}) {
	return prismaClient.$transaction(
		async (transaction: GenerationPrismaClient) => {
			const providerRequestId =
				error.providerRequestId ?? usage.providerRequestId;
			const messageResult = await transaction.message.updateMany({
				where: {
					id: assistantMessageId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					content,
					status: "failed",
					isError: true,
					errorCode: error.errorCode,
					providerStatusCode: error.providerStatusCode ?? null,
					providerRequestId,
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					lastChunkAt: now,
				},
			});

			if (messageResult.count !== 1) {
				return false;
			}

			const generationResult = await transaction.generation.updateMany({
				where: {
					id: generationId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					status: "failed",
					errorCode: error.errorCode,
					providerStatusCode: error.providerStatusCode ?? null,
					providerRequestId,
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					lastChunkAt: now,
				},
			});

			if (generationResult.count !== 1) {
				throw new Error(
					"Generation state changed during failure persistence"
				);
			}

			await finalizeUsageEventInTransaction({
				prismaClient: transaction,
				deduplicationKey: `generation:${generationId}`,
				outcome: "failed",
				measurement: {
					...usage,
					providerRequestId,
				},
				errorCode: error.errorCode,
				providerStatusCode: error.providerStatusCode,
				finalizedAt: now,
			});

			return true;
		}
	);
}

export async function moderateGeneration({
	prismaClient = prisma,
	assistantMessageId,
	generationId,
	content,
	errorCode,
	usage,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	generationId: string;
	content: string;
	errorCode: string;
	usage: UsageMeasurement;
	now?: Date;
}) {
	return prismaClient.$transaction(
		async (transaction: GenerationPrismaClient) => {
			const messageResult = await transaction.message.updateMany({
				where: {
					id: assistantMessageId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					content,
					status: "moderated",
					isError: true,
					errorCode,
					providerStatusCode: null,
					providerRequestId: usage.providerRequestId,
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					completedAt: now,
					lastChunkAt: now,
				},
			});

			if (messageResult.count !== 1) {
				return false;
			}

			const generationResult = await transaction.generation.updateMany({
				where: {
					id: generationId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					status: "moderated",
					errorCode,
					providerStatusCode: null,
					providerRequestId: usage.providerRequestId,
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					completedAt: now,
					lastChunkAt: now,
				},
			});

			if (generationResult.count !== 1) {
				throw new Error(
					"Generation state changed during moderation persistence"
				);
			}

			await finalizeUsageEventInTransaction({
				prismaClient: transaction,
				deduplicationKey: `generation:${generationId}`,
				outcome: "moderated",
				measurement: usage,
				errorCode,
				finalizedAt: now,
			});

			return true;
		}
	);
}

export async function cancelGenerationByAssistantMessage({
	prismaClient = prisma,
	assistantMessageId,
	userId,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	userId: string;
	now?: Date;
}) {
	const message = await prismaClient.message.findFirst({
		where: {
			id: assistantMessageId,
			role: "assistant",
			conversation: { userId },
		},
		select: {
			id: true,
			content: true,
			status: true,
			generationAsAssistantMessage: {
				select: {
					id: true,
					status: true,
					provider: true,
					model: true,
					contextEstimatedTokens: true,
				},
			},
		},
	});

	if (!message) {
		return null;
	}

	const generation = message.generationAsAssistantMessage;
	if (!ACTIVE_STATUSES.includes(message.status as DurableMessageStatus)) {
		return {
			messageId: message.id,
			generationId: generation?.id ?? null,
			status: message.status as DurableMessageStatus,
			content: message.content,
			aborted: false,
		};
	}

	const measurement = generation
		? buildUsageMeasurement({
				requestedModel: generation.model,
				estimatedInputTokens: generation.contextEstimatedTokens,
				estimatedOutputTokens: estimateOutputTokens({
					content: message.content,
					provider: generation.provider,
					model: generation.model,
				}),
				outcome: "cancelled",
				hasPartialOutput: Boolean(message.content),
			})
		: null;
	const updated = await prismaClient.$transaction(
		async (transaction: GenerationPrismaClient) => {
			const updatedMessage = await transaction.message.updateMany({
				where: {
					id: assistantMessageId,
					status: { in: ACTIVE_STATUSES },
				},
				data: {
					status: "cancelled",
					isError: false,
					promptTokens: measurement?.inputTokens,
					completionTokens: measurement?.outputTokens,
					cancelledAt: now,
					lastChunkAt: now,
				},
			});

			if (updatedMessage.count !== 1) {
				const current = await transaction.message.findUnique({
					where: { id: assistantMessageId },
					select: {
						id: true,
						content: true,
						status: true,
					},
				});

				return current
					? {
							messageId: current.id,
							generationId: generation?.id ?? null,
							status: current.status as DurableMessageStatus,
							content: current.content,
							aborted: false,
						}
					: null;
			}

			if (generation) {
				await transaction.generation.updateMany({
					where: {
						id: generation.id,
						status: { in: ACTIVE_STATUSES },
					},
					data: {
						status: "cancelled",
						promptTokens: measurement!.inputTokens,
						completionTokens: measurement!.outputTokens,
						cancelledAt: now,
						lastChunkAt: now,
					},
				});
				await finalizeUsageEventInTransaction({
					prismaClient: transaction,
					deduplicationKey: `generation:${generation.id}`,
					outcome: "cancelled",
					measurement: measurement!,
					finalizedAt: now,
				});
			}

			return {
				messageId: message.id,
				generationId: generation?.id ?? null,
				status: "cancelled" as DurableMessageStatus,
				content: message.content,
				aborted: false,
			};
		}
	);

	if (updated?.status === "cancelled" && generation) {
		return {
			...updated,
			aborted: abortRegisteredGeneration(generation.id),
		};
	}

	return updated;
}

export async function markStaleGenerationsFailed({
	prismaClient = prisma,
	userId,
	conversationId,
	now = new Date(),
	timeoutMs = getGenerationStaleTimeoutMs(),
}: {
	prismaClient?: GenerationPrismaClient;
	userId?: string;
	conversationId?: string;
	now?: Date;
	timeoutMs?: number;
}) {
	const cutoff = new Date(now.getTime() - timeoutMs);
	const staleGenerations: Array<{
		id: string;
		assistantMessageId: string;
		provider: string;
		model: string;
		contextEstimatedTokens: number | null;
		assistantMessage: { content: string };
	}> = await prismaClient.generation.findMany({
		where: {
			status: { in: ACTIVE_STATUSES },
			...(userId ? { userId } : {}),
			...(conversationId ? { conversationId } : {}),
			OR: [
				{ lastChunkAt: null, startedAt: { lt: cutoff } },
				{ lastChunkAt: { lt: cutoff } },
			],
		},
		select: {
			id: true,
			assistantMessageId: true,
			provider: true,
			model: true,
			contextEstimatedTokens: true,
			assistantMessage: { select: { content: true } },
		},
	});

	await Promise.all(
		staleGenerations.map((generation) => {
			const measurement = buildUsageMeasurement({
				requestedModel: generation.model,
				estimatedInputTokens: generation.contextEstimatedTokens,
				estimatedOutputTokens: estimateOutputTokens({
					content: generation.assistantMessage.content,
					provider: generation.provider,
					model: generation.model,
				}),
				outcome: "failed",
				hasPartialOutput: Boolean(generation.assistantMessage.content),
			});

			return prismaClient.$transaction(
				async (transaction: GenerationPrismaClient) => {
					await transaction.message.updateMany({
						where: {
							id: generation.assistantMessageId,
							status: { in: ACTIVE_STATUSES },
						},
						data: {
							status: "failed",
							isError: true,
							errorCode: "STREAM_TIMEOUT",
							promptTokens: measurement.inputTokens,
							completionTokens: measurement.outputTokens,
							lastChunkAt: now,
						},
					});
					const generationResult =
						await transaction.generation.updateMany({
							where: {
								id: generation.id,
								status: { in: ACTIVE_STATUSES },
							},
							data: {
								status: "failed",
								errorCode: "STREAM_TIMEOUT",
								promptTokens: measurement.inputTokens,
								completionTokens: measurement.outputTokens,
								lastChunkAt: now,
							},
						});

					if (generationResult.count === 1) {
						await finalizeUsageEventInTransaction({
							prismaClient: transaction,
							deduplicationKey: `generation:${generation.id}`,
							outcome: "failed",
							measurement,
							errorCode: "STREAM_TIMEOUT",
							finalizedAt: now,
						});
					}
				}
			);
		})
	);

	return { count: staleGenerations.length };
}

export function isTerminalMessageStatus(status: string | null | undefined) {
	return TERMINAL_STATUSES.includes(status as DurableMessageStatus);
}
