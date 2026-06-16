import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtcMonthWindow } from "@/lib/subscription";
import {
	buildUsageMeasurement,
	estimateOutputTokens,
	finalizeStaleUsageAttempts,
	getStaleUsageTimeoutMs,
} from "@/lib/usage/usage-service";

type BackfillPrismaClient = any;

interface BackfillOptions {
	prismaClient?: BackfillPrismaClient;
	dryRun?: boolean;
	batchSize?: number;
	staleTimeoutMs?: number;
}

interface BackfillCounts {
	staleAttempts: number;
	generations: number;
	legacyMessages: number;
	quotaRows: number;
}

function toUsageOutcome(status: string) {
	if (status === "cancelled") return "cancelled" as const;
	if (status === "moderated") return "moderated" as const;
	if (status === "completed") return "completed" as const;
	return "failed" as const;
}

async function backfillGenerations({
	prismaClient,
	dryRun,
	batchSize,
}: Required<BackfillOptions>) {
	let cursor: string | undefined;
	let created = 0;

	while (true) {
		const generations = await prismaClient.generation.findMany({
			where: {
				status: {
					in: ["completed", "failed", "cancelled", "moderated"],
				},
				usageEvent: null,
			},
			orderBy: { id: "asc" },
			take: batchSize,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			select: {
				id: true,
				userId: true,
				conversationId: true,
				assistantMessageId: true,
				provider: true,
				model: true,
				status: true,
				promptTokens: true,
				completionTokens: true,
				providerRequestId: true,
				errorCode: true,
				providerStatusCode: true,
				startedAt: true,
				completedAt: true,
				cancelledAt: true,
				createdAt: true,
				promptVersion: true,
				contextEstimatedTokens: true,
				assistantMessage: { select: { content: true } },
			},
		});

		if (!generations.length) break;

		for (const generation of generations) {
			const finalizedAt =
				generation.completedAt ??
				generation.cancelledAt ??
				generation.createdAt;
			const hasStoredUsage =
				generation.promptTokens != null ||
				generation.completionTokens != null;
			const measurement = buildUsageMeasurement({
				requestedModel: generation.model,
				providerRequestId: generation.providerRequestId,
				providerUsage: hasStoredUsage
					? {
							promptTokens: generation.promptTokens ?? 0,
							completionTokens: generation.completionTokens ?? 0,
						}
					: null,
				estimatedInputTokens: generation.contextEstimatedTokens,
				estimatedOutputTokens: estimateOutputTokens({
					content: generation.assistantMessage.content,
					provider: generation.provider,
					model: generation.model,
				}),
				outcome: toUsageOutcome(generation.status),
				hasPartialOutput: Boolean(generation.assistantMessage.content),
				usageSourceOverride: "legacy_unknown",
			});

			created += 1;
			if (dryRun) continue;

			await prismaClient.usageEvent.create({
				data: {
					deduplicationKey: `generation:${generation.id}`,
					userId: generation.userId,
					conversationId: generation.conversationId,
					messageId: generation.assistantMessageId,
					generationId: generation.id,
					feature: "chat_response",
					outcome: toUsageOutcome(generation.status),
					provider: generation.provider,
					requestedModel: generation.model,
					resolvedModel: measurement.resolvedModel,
					promptVersion: generation.promptVersion,
					providerRequestId: measurement.providerRequestId,
					inputTokens: measurement.inputTokens,
					outputTokens: measurement.outputTokens,
					billableUnits: measurement.billableUnits,
					usageSource: measurement.usageSource,
					estimatedCostUsd: measurement.estimatedCostUsd,
					costIsEstimate: measurement.costIsEstimate,
					pricingVersion: measurement.pricingVersion,
					errorCode: generation.errorCode,
					providerStatusCode: generation.providerStatusCode,
					startedAt: generation.startedAt ?? generation.createdAt,
					finalizedAt,
					createdAt: generation.createdAt,
				},
			});
		}

		cursor = generations.at(-1)?.id;
		if (generations.length < batchSize) break;
	}

	return created;
}

async function backfillLegacyMessages({
	prismaClient,
	dryRun,
	batchSize,
}: Required<BackfillOptions>) {
	let cursor: string | undefined;
	let created = 0;

	while (true) {
		const messages = await prismaClient.message.findMany({
			where: {
				role: "assistant",
				status: {
					in: ["completed", "failed", "cancelled", "moderated"],
				},
				generationAsAssistantMessage: null,
				usageEvents: { none: {} },
			},
			orderBy: { id: "asc" },
			take: batchSize,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			select: {
				id: true,
				conversationId: true,
				model: true,
				status: true,
				promptTokens: true,
				completionTokens: true,
				providerRequestId: true,
				errorCode: true,
				providerStatusCode: true,
				startedAt: true,
				completedAt: true,
				cancelledAt: true,
				createdAt: true,
				promptVersion: true,
				contextEstimatedTokens: true,
				content: true,
				conversation: { select: { userId: true } },
			},
		});

		if (!messages.length) break;

		for (const message of messages) {
			const model = message.model ?? "legacy-unknown";
			const hasStoredUsage =
				message.promptTokens != null ||
				message.completionTokens != null;
			const measurement = buildUsageMeasurement({
				requestedModel: model,
				providerRequestId: message.providerRequestId,
				providerUsage: hasStoredUsage
					? {
							promptTokens: message.promptTokens ?? 0,
							completionTokens: message.completionTokens ?? 0,
						}
					: null,
				estimatedInputTokens: message.contextEstimatedTokens,
				estimatedOutputTokens: estimateOutputTokens({
					content: message.content,
					provider: "legacy_unknown",
					model,
				}),
				outcome: toUsageOutcome(message.status),
				hasPartialOutput: Boolean(message.content),
				usageSourceOverride: "legacy_unknown",
			});

			created += 1;
			if (dryRun) continue;

			await prismaClient.usageEvent.create({
				data: {
					deduplicationKey: `legacy-message:${message.id}`,
					userId: message.conversation.userId,
					conversationId: message.conversationId,
					messageId: message.id,
					feature: "chat_response",
					outcome: toUsageOutcome(message.status),
					provider: "legacy_unknown",
					requestedModel: model,
					promptVersion: message.promptVersion,
					providerRequestId: measurement.providerRequestId,
					inputTokens: measurement.inputTokens,
					outputTokens: measurement.outputTokens,
					billableUnits: measurement.billableUnits,
					usageSource: measurement.usageSource,
					estimatedCostUsd: measurement.estimatedCostUsd,
					costIsEstimate: measurement.costIsEstimate,
					pricingVersion: measurement.pricingVersion,
					errorCode: message.errorCode,
					providerStatusCode: message.providerStatusCode,
					startedAt: message.startedAt ?? message.createdAt,
					finalizedAt:
						message.completedAt ??
						message.cancelledAt ??
						message.createdAt,
					createdAt: message.createdAt,
				},
			});
		}

		cursor = messages.at(-1)?.id;
		if (messages.length < batchSize) break;
	}

	return created;
}

export async function rebuildUserQuotaLedgers({
	prismaClient = prisma,
	dryRun = false,
	batchSize = 500,
}: BackfillOptions = {}) {
	const totals = new Map<
		string,
		{
			subjectId: string;
			windowStart: Date;
			windowEnd: Date;
			usedTokens: number;
			usedUsd: Prisma.Decimal;
		}
	>();
	let cursor: string | undefined;

	while (true) {
		const events = await prismaClient.usageEvent.findMany({
			where: {
				userId: { not: null },
				outcome: { not: "pending" },
			},
			orderBy: { id: "asc" },
			take: batchSize,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			select: {
				id: true,
				userId: true,
				billableUnits: true,
				estimatedCostUsd: true,
				finalizedAt: true,
				createdAt: true,
			},
		});

		if (!events.length) break;

		for (const event of events) {
			if (!event.userId) continue;
			const { start, end } = getUtcMonthWindow(
				event.finalizedAt ?? event.createdAt
			);
			const key = `${event.userId}:${start.toISOString()}`;
			const current = totals.get(key) ?? {
				subjectId: event.userId,
				windowStart: start,
				windowEnd: end,
				usedTokens: 0,
				usedUsd: new Prisma.Decimal(0),
			};
			current.usedTokens += event.billableUnits;
			current.usedUsd = current.usedUsd.plus(event.estimatedCostUsd ?? 0);
			totals.set(key, current);
		}

		cursor = events.at(-1)?.id;
		if (events.length < batchSize) break;
	}

	if (!dryRun) {
		await prismaClient.$transaction(
			async (transaction: BackfillPrismaClient) => {
				await transaction.quotaLedger.deleteMany({
					where: { subjectType: "user" },
				});
				if (totals.size) {
					await transaction.quotaLedger.createMany({
						data: Array.from(totals.values()).map((total) => ({
							subjectType: "user",
							...total,
						})),
					});
				}
			}
		);
	}

	return totals.size;
}

export async function backfillUsageLedger({
	prismaClient = prisma,
	dryRun = false,
	batchSize = 100,
	staleTimeoutMs = getStaleUsageTimeoutMs(),
}: BackfillOptions = {}): Promise<BackfillCounts> {
	const options = { prismaClient, dryRun, batchSize, staleTimeoutMs };
	const staleAttempts = await finalizeStaleUsageAttempts({
		prismaClient,
		dryRun,
		timeoutMs: staleTimeoutMs,
	});
	const generations = await backfillGenerations(options);
	const legacyMessages = await backfillLegacyMessages(options);
	const quotaRows = await rebuildUserQuotaLedgers(options);

	return {
		staleAttempts: staleAttempts.count,
		generations,
		legacyMessages,
		quotaRows,
	};
}
