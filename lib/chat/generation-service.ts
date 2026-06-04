import type { NormalizedStreamError } from "@/lib/ai/errors";
import { prisma } from "@/lib/prisma";
import { abortRegisteredGeneration } from "@/lib/chat/generation-abort-registry";

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
}: CreateGenerationAttemptInput): Promise<GenerationAttempt> {
	const now = new Date();
	const assistantMessage = await prismaClient.message.create({
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
		},
		select: { id: true },
	});

	const generation = await prismaClient.generation.create({
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
		},
		select: { id: true },
	});

	return { assistantMessage, generation };
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
	promptTokens,
	completionTokens,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	generationId: string;
	content: string;
	promptTokens: number;
	completionTokens: number;
	now?: Date;
}) {
	const messageResult = await prismaClient.message.updateMany({
		where: {
			id: assistantMessageId,
			status: { in: ACTIVE_STATUSES },
		},
		data: {
			content,
			status: "completed",
			isError: false,
			promptTokens,
			completionTokens,
			errorCode: null,
			providerStatusCode: null,
			providerRequestId: null,
			completedAt: now,
			lastChunkAt: now,
		},
	});

	if (messageResult.count !== 1) {
		return false;
	}

	await prismaClient.generation.updateMany({
		where: {
			id: generationId,
			status: { in: ACTIVE_STATUSES },
		},
		data: {
			status: "completed",
			promptTokens,
			completionTokens,
			errorCode: null,
			providerStatusCode: null,
			providerRequestId: null,
			completedAt: now,
			lastChunkAt: now,
		},
	});

	return true;
}

export async function failGeneration({
	prismaClient = prisma,
	assistantMessageId,
	generationId,
	content,
	error,
	now = new Date(),
}: {
	prismaClient?: GenerationPrismaClient;
	assistantMessageId: string;
	generationId: string;
	content: string;
	error: NormalizedStreamError;
	now?: Date;
}) {
	const messageResult = await prismaClient.message.updateMany({
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
			providerRequestId: error.providerRequestId ?? null,
			lastChunkAt: now,
		},
	});

	if (messageResult.count !== 1) {
		return false;
	}

	await prismaClient.generation.updateMany({
		where: {
			id: generationId,
			status: { in: ACTIVE_STATUSES },
		},
		data: {
			status: "failed",
			errorCode: error.errorCode,
			providerStatusCode: error.providerStatusCode ?? null,
			providerRequestId: error.providerRequestId ?? null,
			lastChunkAt: now,
		},
	});

	return true;
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

	const updatedMessage = await prismaClient.message.updateMany({
		where: {
			id: assistantMessageId,
			status: { in: ACTIVE_STATUSES },
		},
		data: {
			status: "cancelled",
			isError: false,
			cancelledAt: now,
			lastChunkAt: now,
		},
	});

	if (updatedMessage.count !== 1) {
		const current = await prismaClient.message.findUnique({
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

	let aborted = false;
	if (generation) {
		await prismaClient.generation.updateMany({
			where: {
				id: generation.id,
				status: { in: ACTIVE_STATUSES },
			},
			data: {
				status: "cancelled",
				cancelledAt: now,
				lastChunkAt: now,
			},
		});
		aborted = abortRegisteredGeneration(generation.id);
	}

	return {
		messageId: message.id,
		generationId: generation?.id ?? null,
		status: "cancelled" as DurableMessageStatus,
		content: message.content,
		aborted,
	};
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
		},
	});

	await Promise.all(
		staleGenerations.map((generation) =>
			Promise.all([
				prismaClient.message.updateMany({
					where: {
						id: generation.assistantMessageId,
						status: { in: ACTIVE_STATUSES },
					},
					data: {
						status: "failed",
						isError: true,
						errorCode: "STREAM_TIMEOUT",
						lastChunkAt: now,
					},
				}),
				prismaClient.generation.updateMany({
					where: {
						id: generation.id,
						status: { in: ACTIVE_STATUSES },
					},
					data: {
						status: "failed",
						errorCode: "STREAM_TIMEOUT",
						lastChunkAt: now,
					},
				}),
			])
		)
	);

	return { count: staleGenerations.length };
}

export function isTerminalMessageStatus(status: string | null | undefined) {
	return TERMINAL_STATUSES.includes(status as DurableMessageStatus);
}
