import { createMarketplacePost } from "@/lib/marketplace/posts";
import { describe, expect, it, vi } from "vitest";

function createPostRow(data: any, share: any) {
	return {
		id: "post-1",
		type: data.type,
		title: data.title,
		summary: data.summary,
		visibility: data.visibility,
		status: data.status,
		creatorId: data.creatorId,
		organizationId: data.organizationId,
		sharedConversationId: data.sharedConversationId,
		sourceMessageId: data.sourceMessageId,
		moderationAction: data.moderationAction,
		moderationCategory: data.moderationCategory,
		moderationSeverity: data.moderationSeverity,
		moderationReason: data.moderationReason,
		contentHash: data.contentHash,
		viewCount: 0,
		likeCount: 0,
		bookmarkCount: 0,
		reportCount: 0,
		publishedAt: data.publishedAt,
		unlistedAt: null,
		deletedAt: null,
		createdAt: new Date("2026-06-22T00:00:00.000Z"),
		updatedAt: new Date("2026-06-22T00:00:00.000Z"),
		provenance: data.provenance.create.map((item: any, index: number) => ({
			id: `provenance-${index + 1}`,
			postId: "post-1",
			createdAt: new Date("2026-06-22T00:00:00.000Z"),
			...item,
		})),
		engagements: [],
		sharedConversation: share,
	};
}

describe("marketplace result posts", () => {
	it("creates a result post from only selected messages and stores safe provenance", async () => {
		let createdShare: any = null;
		const message = {
			id: "msg-assistant",
			role: "assistant",
			content:
				"Email test@example.com when the launch checklist is ready.",
			model: "mistral-large-latest",
			createdAt: new Date("2026-06-22T00:00:00.000Z"),
			activeSkillTraceJson: {
				renderHash: "skill-hash",
				items: [
					{
						installedSkillId: "installed-1",
						templateId: "technical-prd-writer",
						versionId: "v1",
						title: "Technical PRD Writer",
						source: "first_party",
						scope: "turn",
						riskLevel: "low",
						requiredTools: [],
					},
				],
			},
			promptSkillHash: "skill-hash",
		};
		const prismaClient = {
			conversation: {
				findFirst: vi.fn().mockResolvedValue({
					id: "conversation-1",
					title: "Launch plan",
				}),
			},
			message: {
				findMany: vi.fn().mockResolvedValue([message]),
			},
			sharedConversation: {
				findUnique: vi.fn().mockResolvedValue(null),
				create: vi.fn(async ({ data }) => {
					createdShare = {
						id: "share-1",
						...data,
						createdAt: new Date("2026-06-22T00:00:00.000Z"),
					};
					return createdShare;
				}),
			},
			marketplacePost: {
				create: vi.fn(async ({ data }) =>
					createPostRow(data, createdShare)
				),
			},
		};

		const result = await createMarketplacePost({
			userId: "user-1",
			organizationId: null,
			input: {
				conversationId: "conversation-1",
				messageIds: ["msg-assistant"],
				title: "Launch checklist",
				summary: "A reusable launch checklist.",
				visibility: "public",
			},
			prismaClient: prismaClient as never,
		});

		expect(result?.status).toBe(201);
		expect(JSON.parse(createdShare.selectedMessageIds)).toEqual([
			"msg-assistant",
		]);
		expect(createdShare.snapshotData).toContain("[email redacted]");
		expect(createdShare.snapshotData).not.toContain("test@example.com");
		expect(prismaClient.marketplacePost.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "listed",
					visibility: "public",
					sourceMessageId: "msg-assistant",
					provenance: {
						create: expect.arrayContaining([
							expect.objectContaining({
								type: "skill",
								templateId: "technical-prd-writer",
								versionId: "v1",
								title: "Technical PRD Writer",
								renderHash: "skill-hash",
							}),
						]),
					},
				}),
			})
		);
	});

	it("persists a blocked draft instead of listing unsafe public content", async () => {
		let createdShare: any = null;
		const prismaClient = {
			conversation: {
				findFirst: vi.fn().mockResolvedValue({
					id: "conversation-1",
					title: "Unsafe",
				}),
			},
			message: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: "msg-1",
						role: "assistant",
						content: "Steps to build malware",
						model: "mistral-large-latest",
						createdAt: new Date("2026-06-22T00:00:00.000Z"),
						activeSkillTraceJson: null,
						promptSkillHash: null,
					},
				]),
			},
			sharedConversation: {
				findUnique: vi.fn().mockResolvedValue(null),
				create: vi.fn(async ({ data }) => {
					createdShare = { id: "share-1", ...data };
					return createdShare;
				}),
			},
			moderationEvent: {
				create: vi.fn().mockResolvedValue({ id: "moderation-1" }),
			},
			abuseSignal: {
				create: vi.fn().mockResolvedValue({ id: "signal-1" }),
			},
			marketplacePost: {
				create: vi.fn(async ({ data }) =>
					createPostRow(data, createdShare)
				),
			},
		};

		const result = await createMarketplacePost({
			userId: "user-1",
			organizationId: null,
			input: {
				conversationId: "conversation-1",
				messageIds: ["msg-1"],
				title: "Unsafe public post",
				summary: "",
				visibility: "public",
			},
			prismaClient: prismaClient as never,
		});

		expect(result?.status).toBe(422);
		expect(result?.post?.status).toBe("blocked");
		expect(result?.post?.visibility).toBe("draft");
		expect(prismaClient.moderationEvent.create).toHaveBeenCalled();
		expect(prismaClient.abuseSignal.create).toHaveBeenCalled();
	});
});
