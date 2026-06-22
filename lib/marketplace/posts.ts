import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
	evaluateAggregateContentModeration,
	hashModeratedContent,
	isBlockingModerationDecision,
	recordAbuseSignal,
	recordModerationEvent,
	shouldPersistModerationDecision,
} from "@/lib/moderation/moderation-service";
import { prisma } from "@/lib/prisma";
import { detectShareMaskFindings } from "@/lib/share/masking";
import { buildSharePersistencePayload } from "@/lib/share/service";
import type { ActiveSkillTrace } from "@/lib/skills/catalog";

type MarketplacePrismaClient = any;

const MAX_POST_MESSAGES = 20;
const MAX_POST_CHARS = 50_000;

export const marketplacePostVisibilitySchema = z.enum([
	"draft",
	"unlisted",
	"public",
]);

export const createMarketplacePostSchema = z
	.object({
		conversationId: z.string().trim().min(1).optional(),
		messageIds: z
			.array(z.string().trim().min(1))
			.min(1)
			.max(MAX_POST_MESSAGES)
			.optional(),
		shareToken: z.string().trim().min(1).max(120).optional(),
		title: z.string().trim().min(3).max(120),
		summary: z.string().trim().max(1000).default(""),
		visibility: marketplacePostVisibilitySchema.default("draft"),
	})
	.refine(
		(input) =>
			input.shareToken ||
			(input.conversationId && input.messageIds?.length),
		{
			message:
				"Provide either shareToken or conversationId with messageIds.",
			path: ["messageIds"],
		}
	);

export const updateMarketplacePostSchema = z.object({
	title: z.string().trim().min(3).max(120).optional(),
	summary: z.string().trim().max(1000).optional(),
	visibility: marketplacePostVisibilitySchema.optional(),
});

export const marketplaceEngagementSchema = z.object({
	type: z.enum(["like", "bookmark"]),
	enabled: z.boolean().default(true),
});

export const marketplaceReportSchema = z.object({
	reason: z.string().trim().min(3).max(500),
});

export type CreateMarketplacePostInput = z.infer<
	typeof createMarketplacePostSchema
>;
export type UpdateMarketplacePostInput = z.infer<
	typeof updateMarketplacePostSchema
>;

type ShareableMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	model?: string | null;
	createdAt: Date;
	activeSkillTraceJson?: unknown;
	promptSkillHash?: string | null;
};

function generateShareToken() {
	return randomBytes(8).toString("base64url").slice(0, 10);
}

function isUniqueConstraintError(error: unknown) {
	return (
		!!error &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: unknown }).code === "P2002"
	);
}

function isActiveSkillTrace(value: unknown): value is ActiveSkillTrace {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as { items?: unknown }).items) &&
		typeof (value as { renderHash?: unknown }).renderHash === "string"
	);
}

function orderedMessages<T extends { id: string }>(
	messages: T[],
	ids: string[]
) {
	const byId = new Map(messages.map((message) => [message.id, message]));
	return ids
		.map((id) => byId.get(id))
		.filter((message): message is T => !!message);
}

function totalContentLength(messages: Array<{ content: string }>) {
	return messages.reduce((sum, message) => sum + message.content.length, 0);
}

function buildSelections(messages: ShareableMessage[]) {
	return messages.map((message) => ({
		id: message.id,
		approvedFindingIds: detectShareMaskFindings(message.content).map(
			(finding) => finding.id
		),
		redactWholeMessage: false,
	}));
}

function postStatusForVisibility(visibility: "draft" | "unlisted" | "public") {
	return visibility === "draft" ? "draft" : "listed";
}

function serializeProvenance(row: any) {
	return {
		id: row.id,
		type: row.type,
		templateId: row.templateId,
		versionId: row.versionId,
		installedSkillId: row.installedSkillId,
		title: row.title,
		source: row.source,
		riskLevel: row.riskLevel,
		requiredTools: row.requiredTools ?? [],
		renderHash: row.renderHash,
	};
}

export function serializeMarketplacePost(
	row: any,
	viewerUserId?: string | null
) {
	const engagements = Array.isArray(row.engagements) ? row.engagements : [];
	const viewerEngagements = new Set(
		engagements
			.filter(
				(engagement: any) =>
					!viewerUserId || engagement.userId === viewerUserId
			)
			.map((engagement: any) => engagement.type)
	);

	return {
		id: row.id,
		type: row.type,
		title: row.title,
		summary: row.summary,
		visibility: row.visibility,
		status: row.status,
		creatorId: row.creatorId,
		organizationId: row.organizationId,
		sharedConversationId: row.sharedConversationId,
		sourceMessageId: row.sourceMessageId,
		moderation: {
			action: row.moderationAction,
			category: row.moderationCategory,
			severity: row.moderationSeverity,
			reason: row.moderationReason,
		},
		counts: {
			views: row.viewCount,
			likes: row.likeCount,
			bookmarks: row.bookmarkCount,
			reports: row.reportCount,
		},
		viewer: {
			liked: viewerEngagements.has("like"),
			bookmarked: viewerEngagements.has("bookmark"),
		},
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		publishedAt: row.publishedAt?.toISOString() ?? null,
		unlistedAt: row.unlistedAt?.toISOString() ?? null,
		provenance: (row.provenance ?? []).map(serializeProvenance),
		share: row.sharedConversation
			? {
					token: row.sharedConversation.shareToken,
					title: row.sharedConversation.title,
					snapshotData: row.sharedConversation.snapshotData,
					summaryData: row.sharedConversation.summaryData,
					showTimestamps: row.sharedConversation.showTimestamps,
					showModel: row.sharedConversation.showModel,
				}
			: null,
	};
}

async function createShareWithUniqueToken({
	prismaClient,
	data,
}: {
	prismaClient: MarketplacePrismaClient;
	data: any;
}) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const shareToken = generateShareToken();
		const existingShare = await prismaClient.sharedConversation.findUnique({
			where: { shareToken },
			select: { id: true },
		});
		if (existingShare) continue;

		try {
			return await prismaClient.sharedConversation.create({
				data: { ...data, shareToken },
			});
		} catch (error) {
			if (isUniqueConstraintError(error)) continue;
			throw error;
		}
	}

	throw new Error("Unable to generate a unique marketplace share token");
}

function provenanceFromMessages(messages: ShareableMessage[]) {
	const seen = new Set<string>();
	const provenance: Array<{
		type: "skill" | "model";
		templateId?: string;
		versionId?: string;
		installedSkillId?: string;
		title: string;
		source?: string;
		riskLevel?: "low" | "medium" | "high";
		requiredTools: string[];
		renderHash?: string;
		metadataJson?: unknown;
	}> = [];

	for (const message of messages) {
		if (message.model) {
			const key = `model:${message.model}`;
			if (!seen.has(key)) {
				seen.add(key);
				provenance.push({
					type: "model",
					title: message.model,
					source: "provider",
					requiredTools: [],
				});
			}
		}

		const trace = isActiveSkillTrace(message.activeSkillTraceJson)
			? message.activeSkillTraceJson
			: null;
		if (!trace) continue;

		for (const item of trace.items) {
			const key = `skill:${item.templateId}:${item.versionId}`;
			if (seen.has(key)) continue;
			seen.add(key);
			provenance.push({
				type: "skill",
				templateId: item.templateId,
				versionId: item.versionId,
				installedSkillId: item.installedSkillId,
				title: item.title,
				source: item.source,
				riskLevel: item.riskLevel,
				requiredTools: item.requiredTools,
				renderHash: trace.renderHash,
			});
		}
	}

	return provenance;
}

async function createShareFromMessages({
	prismaClient,
	userId,
	organizationId,
	conversationId,
	title,
	messages,
}: {
	prismaClient: MarketplacePrismaClient;
	userId: string;
	organizationId: string | null;
	conversationId: string;
	title: string;
	messages: ShareableMessage[];
}) {
	const selections = buildSelections(messages);
	const payload = buildSharePersistencePayload({
		messages,
		messageSelections: selections,
		autoMaskPII: true,
		summary: null,
	});

	return createShareWithUniqueToken({
		prismaClient,
		data: {
			conversationId,
			createdBy: userId,
			organizationId,
			selectedMessageIds: JSON.stringify(payload.selectedMessageIds),
			snapshotData: JSON.stringify(payload.snapshots),
			summaryData: null,
			maskingData: JSON.stringify(payload.maskingData),
			title,
			expiresAt: null,
			allowDownload: false,
			showTimestamps: true,
			showModel: true,
		},
	});
}

async function resolvePostSource({
	prismaClient,
	userId,
	organizationId,
	input,
}: {
	prismaClient: MarketplacePrismaClient;
	userId: string;
	organizationId: string | null;
	input: CreateMarketplacePostInput;
}) {
	if (input.shareToken) {
		const share = await prismaClient.sharedConversation.findFirst({
			where: {
				shareToken: input.shareToken,
				createdBy: userId,
				organizationId,
				isActive: true,
			},
		});
		if (!share) return null;

		let selectedIds: string[] = [];
		try {
			selectedIds = JSON.parse(share.selectedMessageIds) as string[];
		} catch {
			selectedIds = [];
		}

		const messages: ShareableMessage[] =
			selectedIds.length > 0
				? await prismaClient.message.findMany({
						where: {
							id: { in: selectedIds },
							conversationId: share.conversationId,
							role: { in: ["user", "assistant"] },
						},
						select: {
							id: true,
							role: true,
							content: true,
							model: true,
							createdAt: true,
							activeSkillTraceJson: true,
							promptSkillHash: true,
						},
					})
				: [];

		return {
			share,
			conversationId: share.conversationId,
			messages: orderedMessages(messages, selectedIds).map((message) => ({
				...message,
				role: message.role as "user" | "assistant",
			})),
		};
	}

	if (!input.conversationId || !input.messageIds) return null;

	const conversation = await prismaClient.conversation.findFirst({
		where: {
			id: input.conversationId,
			userId,
			organizationId,
		},
		select: { id: true, title: true },
	});
	if (!conversation) return null;

	const messages = (await prismaClient.message.findMany({
		where: {
			id: { in: input.messageIds },
			conversationId: input.conversationId,
			role: { in: ["user", "assistant"] },
		},
		select: {
			id: true,
			role: true,
			content: true,
			model: true,
			createdAt: true,
			activeSkillTraceJson: true,
			promptSkillHash: true,
		},
	})) as ShareableMessage[];
	if (messages.length !== input.messageIds.length) return null;

	const ordered = orderedMessages(messages, input.messageIds).map(
		(message) => ({
			...message,
			role: message.role as "user" | "assistant",
		})
	);
	if (ordered.length !== input.messageIds.length) return null;

	const share = await createShareFromMessages({
		prismaClient,
		userId,
		organizationId,
		conversationId: conversation.id,
		title: input.title || conversation.title,
		messages: ordered,
	});

	return {
		share,
		conversationId: conversation.id,
		messages: ordered,
	};
}

export async function createMarketplacePost({
	userId,
	organizationId,
	input,
	prismaClient = prisma,
}: {
	userId: string;
	organizationId: string | null;
	input: CreateMarketplacePostInput;
	prismaClient?: MarketplacePrismaClient;
}) {
	const source = await resolvePostSource({
		prismaClient,
		userId,
		organizationId,
		input,
	});
	if (!source) return null;

	if (totalContentLength(source.messages) > MAX_POST_CHARS) {
		return {
			blocked: true as const,
			status: 400,
			error: "Selected content is too large.",
		};
	}

	const snapshotText = source.messages
		.map((message) => message.content)
		.join("\n\n");
	const moderationText = [input.title, input.summary, snapshotText].join(
		"\n\n"
	);
	const moderationDecision = evaluateAggregateContentModeration({
		contents: [input.title, input.summary, snapshotText],
		source: "share_snapshot",
	});
	const shouldList = input.visibility !== "draft";
	const blocked =
		shouldList && isBlockingModerationDecision(moderationDecision);
	const contentHash = hashModeratedContent(moderationText);

	if (shouldPersistModerationDecision(moderationDecision) || blocked) {
		await recordModerationEvent({
			prismaClient,
			decision: moderationDecision,
			source: "share_snapshot",
			stage: "share_create",
			contentHash,
			contentLength: moderationText.length,
			userId,
			organizationId,
			conversationId: source.conversationId,
			sharedConversationId: source.share.id,
			metadata: {
				target: "marketplace_post",
				visibility: input.visibility,
			},
		});
	}

	if (blocked) {
		await recordAbuseSignal({
			prismaClient,
			signalType: "moderation_block",
			severity: moderationDecision.severity,
			action: "block",
			userId,
			organizationId,
			conversationId: source.conversationId,
			metadata: {
				category: moderationDecision.category,
				stage: "marketplace_publish",
			},
		});
	}

	const provenance = provenanceFromMessages(source.messages);
	const now = new Date();
	const post = await prismaClient.marketplacePost.create({
		data: {
			type: "result",
			title: input.title,
			summary: input.summary,
			visibility: blocked ? "draft" : input.visibility,
			status: blocked
				? "blocked"
				: postStatusForVisibility(input.visibility),
			creatorId: userId,
			organizationId,
			sharedConversationId: source.share.id,
			sourceMessageId:
				source.messages.length === 1 &&
				source.messages[0]?.role === "assistant"
					? source.messages[0].id
					: null,
			moderationAction: moderationDecision.action,
			moderationCategory: moderationDecision.category,
			moderationSeverity: moderationDecision.severity,
			moderationReason: moderationDecision.reason,
			contentHash,
			publishedAt: !blocked && input.visibility !== "draft" ? now : null,
			provenance: {
				create: provenance.map((item) => ({
					type: item.type,
					templateId: item.templateId ?? null,
					versionId: item.versionId ?? null,
					installedSkillId: item.installedSkillId ?? null,
					title: item.title,
					source: item.source ?? null,
					riskLevel: item.riskLevel ?? null,
					requiredTools: item.requiredTools,
					renderHash: item.renderHash ?? null,
					metadataJson: item.metadataJson ?? undefined,
				})),
			},
		},
		include: {
			provenance: true,
			engagements: true,
			sharedConversation: true,
		},
	});

	return {
		blocked,
		status: blocked ? 422 : 201,
		post: serializeMarketplacePost(post, userId),
		error: blocked
			? "Moderation blocked this post from public marketplace listing."
			: null,
	};
}

export async function updateMarketplacePost({
	userId,
	postId,
	input,
	prismaClient = prisma,
}: {
	userId: string;
	postId: string;
	input: UpdateMarketplacePostInput;
	prismaClient?: MarketplacePrismaClient;
}) {
	const existing = await prismaClient.marketplacePost.findFirst({
		where: { id: postId, creatorId: userId, status: { not: "deleted" } },
		include: { sharedConversation: true },
	});
	if (!existing) return null;

	const nextVisibility = input.visibility ?? existing.visibility;
	const shouldList = nextVisibility !== "draft";
	const moderationText = [
		input.title ?? existing.title,
		input.summary ?? existing.summary,
		existing.sharedConversation.snapshotData,
	].join("\n\n");
	const moderationDecision = evaluateAggregateContentModeration({
		contents: [
			input.title ?? existing.title,
			input.summary ?? existing.summary,
			existing.sharedConversation.snapshotData,
		],
		source: "share_snapshot",
	});
	const blocked =
		shouldList && isBlockingModerationDecision(moderationDecision);
	const now = new Date();

	const post = await prismaClient.marketplacePost.update({
		where: { id: postId },
		data: {
			title: input.title ?? undefined,
			summary: input.summary ?? undefined,
			visibility: blocked ? "draft" : nextVisibility,
			status: blocked
				? "blocked"
				: nextVisibility === "draft" && existing.status === "listed"
					? "unpublished"
					: postStatusForVisibility(nextVisibility),
			moderationAction: moderationDecision.action,
			moderationCategory: moderationDecision.category,
			moderationSeverity: moderationDecision.severity,
			moderationReason: moderationDecision.reason,
			contentHash: hashModeratedContent(moderationText),
			publishedAt:
				!blocked && nextVisibility !== "draft"
					? (existing.publishedAt ?? now)
					: existing.publishedAt,
			unlistedAt: nextVisibility === "draft" ? now : existing.unlistedAt,
		},
		include: {
			provenance: true,
			engagements: true,
			sharedConversation: true,
		},
	});

	return {
		blocked,
		status: blocked ? 422 : 200,
		post: serializeMarketplacePost(post, userId),
		error: blocked
			? "Moderation blocked this post from public marketplace listing."
			: null,
	};
}

export async function deleteMarketplacePost({
	userId,
	postId,
	prismaClient = prisma,
}: {
	userId: string;
	postId: string;
	prismaClient?: MarketplacePrismaClient;
}) {
	const post = await prismaClient.marketplacePost.findFirst({
		where: { id: postId, creatorId: userId, status: { not: "deleted" } },
		select: { id: true },
	});
	if (!post) return false;

	await prismaClient.marketplacePost.update({
		where: { id: postId },
		data: {
			status: "deleted",
			visibility: "draft",
			deletedAt: new Date(),
		},
	});
	return true;
}

export async function getMarketplacePostForOwner({
	userId,
	postId,
	prismaClient = prisma,
}: {
	userId: string;
	postId: string;
	prismaClient?: MarketplacePrismaClient;
}) {
	const post = await prismaClient.marketplacePost.findFirst({
		where: { id: postId, creatorId: userId, status: { not: "deleted" } },
		include: {
			provenance: true,
			engagements: true,
			sharedConversation: true,
		},
	});
	return post ? serializeMarketplacePost(post, userId) : null;
}

export async function getPublicMarketplacePost({
	postId,
	viewerUserId,
	incrementView = false,
	prismaClient = prisma,
}: {
	postId: string;
	viewerUserId?: string | null;
	incrementView?: boolean;
	prismaClient?: MarketplacePrismaClient;
}) {
	const post = await prismaClient.marketplacePost.findFirst({
		where: {
			id: postId,
			status: "listed",
			visibility: { in: ["public", "unlisted"] },
			sharedConversation: { isActive: true },
		},
		include: {
			provenance: true,
			engagements: viewerUserId
				? { where: { userId: viewerUserId } }
				: false,
			sharedConversation: true,
		},
	});
	if (!post) return null;

	if (incrementView) {
		await prismaClient.marketplacePost
			.update({
				where: { id: postId },
				data: { viewCount: { increment: 1 } },
			})
			.catch(() => {});
	}

	return serializeMarketplacePost(post, viewerUserId);
}

export async function listPublicMarketplacePosts({
	viewerUserId,
	prismaClient = prisma,
}: {
	viewerUserId?: string | null;
	prismaClient?: MarketplacePrismaClient;
} = {}) {
	const posts = await prismaClient.marketplacePost.findMany({
		where: { status: "listed", visibility: "public" },
		include: {
			provenance: true,
			engagements: viewerUserId
				? { where: { userId: viewerUserId } }
				: false,
			sharedConversation: true,
		},
		orderBy: { publishedAt: "desc" },
		take: 50,
	});

	return posts.map((post: any) =>
		serializeMarketplacePost(post, viewerUserId)
	);
}

export async function setMarketplacePostEngagement({
	userId,
	postId,
	type,
	enabled,
	prismaClient = prisma,
}: {
	userId: string;
	postId: string;
	type: "like" | "bookmark";
	enabled: boolean;
	prismaClient?: MarketplacePrismaClient;
}) {
	const post = await prismaClient.marketplacePost.findFirst({
		where: {
			id: postId,
			status: "listed",
			visibility: { in: ["public", "unlisted"] },
		},
		select: { id: true },
	});
	if (!post) return null;

	const counter = type === "like" ? "likeCount" : "bookmarkCount";

	if (enabled) {
		try {
			await prismaClient.marketplacePostEngagement.create({
				data: { postId, userId, type },
			});
			await prismaClient.marketplacePost.update({
				where: { id: postId },
				data: { [counter]: { increment: 1 } },
			});
		} catch (error) {
			if (!isUniqueConstraintError(error)) throw error;
		}
	} else {
		const deleted = await prismaClient.marketplacePostEngagement.deleteMany(
			{
				where: { postId, userId, type },
			}
		);
		if (deleted.count > 0) {
			await prismaClient.marketplacePost.update({
				where: { id: postId },
				data: { [counter]: { decrement: 1 } },
			});
		}
	}

	return getPublicMarketplacePost({
		postId,
		viewerUserId: userId,
		prismaClient,
	});
}

export async function reportMarketplacePost({
	userId,
	postId,
	reason,
	prismaClient = prisma,
}: {
	userId: string;
	postId: string;
	reason: string;
	prismaClient?: MarketplacePrismaClient;
}) {
	const post = await prismaClient.marketplacePost.findFirst({
		where: {
			id: postId,
			status: "listed",
			visibility: { in: ["public", "unlisted"] },
		},
		select: { id: true, creatorId: true, organizationId: true },
	});
	if (!post) return false;

	await prismaClient.marketplacePost.update({
		where: { id: postId },
		data: { reportCount: { increment: 1 } },
	});
	await recordAbuseSignal({
		prismaClient,
		signalType: "moderation_block",
		severity: "medium",
		action: "review",
		userId,
		organizationId: post.organizationId,
		metadata: {
			target: "marketplace_post",
			postId,
			reason,
		},
	});

	return true;
}
