import { prisma } from "@/lib/prisma";
import {
	evaluateAggregateContentModeration,
	hashModeratedContent,
	recordModerationEvent,
	shouldPersistModerationDecision,
	type ModerationDecision,
} from "@/lib/moderation/moderation-service";

export type AccountExportFormat = "json" | "markdown";

export interface AccountExportFile {
	content: string;
	contentType: string;
	filename: string;
}

export function normalizeAccountExportFormat(
	value: unknown
): AccountExportFormat {
	return value === "markdown" ? "markdown" : "json";
}

export function getAccountExportFilename(format: AccountExportFormat) {
	const extension = format === "markdown" ? "md" : "json";
	const date = new Date().toISOString().slice(0, 10);
	return `fork-ai-account-export-${date}.${extension}`;
}

function formatMarkdownExport(
	exportData: Awaited<ReturnType<typeof buildAccountExportData>>
) {
	const lines: string[] = [
		"# ForkAI Account Export",
		"",
		`Exported at: ${exportData.exportedAt}`,
		"",
		"## Profile",
		"",
		`- Name: ${exportData.profile.name}`,
		`- Email: ${exportData.profile.email}`,
		`- Email verified: ${exportData.profile.emailVerified ? "yes" : "no"}`,
		`- Created: ${exportData.profile.createdAt}`,
		"",
	];

	if (exportData.organizationMemberships.length > 0) {
		lines.push("## Organization Memberships", "");
		for (const membership of exportData.organizationMemberships) {
			lines.push(
				`- ${membership.organization.name} (${membership.role}) joined ${membership.createdAt}`
			);
		}
		lines.push("");
	}

	lines.push("## Conversations", "");
	for (const conversation of exportData.conversations) {
		lines.push(`### ${conversation.title}`, "");
		lines.push(`Created: ${conversation.createdAt}`);
		lines.push(`Updated: ${conversation.updatedAt}`, "");

		for (const message of conversation.messages) {
			lines.push(`**${message.role}**`);
			lines.push("");
			lines.push(message.content);
			const attachments = message.attachments ?? [];
			if (attachments.length > 0) {
				lines.push("", "Attachments:");
				for (const attachment of attachments) {
					lines.push(
						`- ${attachment.kind}: ${attachment.filename} (${attachment.mimeType}, ${attachment.status})`
					);
				}
			}
			lines.push("");
		}
	}

	lines.push("## Shares", "");
	for (const share of exportData.shares) {
		lines.push(`### ${share.title}`, "");
		lines.push(`- Active: ${share.isActive ? "yes" : "no"}`);
		lines.push(`- Created: ${share.createdAt}`);
		lines.push(`- Expires: ${share.expiresAt ?? "never"}`);
		lines.push(`- Access count: ${share.accessCount}`);
		lines.push("");
	}

	lines.push("## Feedback", "");
	for (const feedback of exportData.feedback) {
		lines.push(
			`- ${feedback.createdAt}: ${feedback.type}, ${feedback.lifecycleState}, reasons: ${feedback.reasons.join(", ") || "none"}`
		);
	}

	lines.push("## AI Usage", "");
	for (const usage of exportData.usageEvents) {
		lines.push(
			`- ${usage.createdAt}: ${usage.feature} ${usage.outcome}, ${usage.billableUnits} tokens, ${usage.estimatedCostUsd ? `$${usage.estimatedCostUsd}` : "cost unknown"}`
		);
	}

	lines.push("", "## Quota Windows", "");
	for (const ledger of exportData.quotaLedgers) {
		lines.push(
			`- ${ledger.windowStart} to ${ledger.windowEnd}: ${ledger.usedTokens} tokens, $${ledger.usedUsd}`
		);
	}

	return lines.join("\n");
}

async function auditAccountExportModeration(
	userId: string,
	exportData: Awaited<ReturnType<typeof buildAccountExportData>>
) {
	const messageContents = exportData.conversations.flatMap((conversation) =>
		conversation.messages.map((message) => message.content)
	);
	const decision = evaluateAggregateContentModeration({
		contents: messageContents,
		source: "account_export",
	});

	if (!shouldPersistModerationDecision(decision)) {
		return;
	}

	const exportDecision: ModerationDecision =
		decision.action === "block"
			? {
					...decision,
					action: "review",
					reason: "High-risk content was included in an owner-scoped account export; export was audited without blocking.",
					userMessage: "This export was audited.",
				}
			: decision;
	const joinedContent = messageContents.join("\n\n");

	await recordModerationEvent({
		decision: exportDecision,
		source: "account_export",
		stage: "account_export",
		contentHash: hashModeratedContent(joinedContent),
		contentLength: joinedContent.length,
		userId,
		metadata: {
			conversationCount: exportData.conversations.length,
			messageCount: messageContents.length,
		},
	});
}

export async function buildAccountExportData(userId: string) {
	const [
		user,
		organizationMemberships,
		conversations,
		shares,
		feedback,
		usageEvents,
		quotaLedgers,
	] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				emailVerified: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
		prisma.member.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				role: true,
				createdAt: true,
				organization: {
					select: {
						id: true,
						name: true,
						slug: true,
						createdAt: true,
					},
				},
			},
		}),
		prisma.conversation.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			include: {
				collection: {
					select: { id: true, name: true, color: true },
				},
				messages: {
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						role: true,
						content: true,
						model: true,
						promptTokens: true,
						completionTokens: true,
						isError: true,
						status: true,
						errorCode: true,
						providerStatusCode: true,
						providerRequestId: true,
						startedAt: true,
						completedAt: true,
						cancelledAt: true,
						lastChunkAt: true,
						promptVersion: true,
						contextSummaryId: true,
						contextEstimatedTokens: true,
						contextRecentMessageCount: true,
						contextTotalMessageCount: true,
						parentMessageId: true,
						createdAt: true,
						attachments: {
							orderBy: { displayOrder: "asc" },
							select: {
								id: true,
								fileObjectId: true,
								kind: true,
								promptUse: true,
								displayOrder: true,
								createdAt: true,
								fileObject: {
									select: {
										id: true,
										filename: true,
										mimeType: true,
										sizeBytes: true,
										status: true,
										kind: true,
										purpose: true,
									},
								},
							},
						},
					},
				},
				summaries: {
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						content: true,
						promptVersion: true,
						provider: true,
						model: true,
						sourceMessageCount: true,
						summarizedThroughMessageId: true,
						createdAt: true,
						updatedAt: true,
					},
				},
			},
		}),
		prisma.sharedConversation.findMany({
			where: { createdBy: userId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				conversationId: true,
				organizationId: true,
				shareToken: true,
				selectedMessageIds: true,
				snapshotData: true,
				summaryData: true,
				maskingData: true,
				title: true,
				createdAt: true,
				expiresAt: true,
				isActive: true,
				accessCount: true,
				allowDownload: true,
				showTimestamps: true,
				showModel: true,
			},
		}),
		prisma.messageFeedback.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				messageId: true,
				type: true,
				reasons: true,
				comment: true,
				correctionJson: true,
				lifecycleState: true,
				redactedComment: true,
				redactedCorrectionJson: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
		prisma.usageEvent.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				organizationId: true,
				conversationId: true,
				messageId: true,
				generationId: true,
				feature: true,
				outcome: true,
				provider: true,
				requestedModel: true,
				resolvedModel: true,
				promptVersion: true,
				providerRequestId: true,
				inputTokens: true,
				outputTokens: true,
				billableUnits: true,
				usageSource: true,
				estimatedCostUsd: true,
				costIsEstimate: true,
				pricingVersion: true,
				errorCode: true,
				providerStatusCode: true,
				startedAt: true,
				finalizedAt: true,
				createdAt: true,
			},
		}),
		prisma.quotaLedger.findMany({
			where: { subjectType: "user", subjectId: userId },
			orderBy: { windowStart: "asc" },
			select: {
				id: true,
				windowStart: true,
				windowEnd: true,
				usedTokens: true,
				usedUsd: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
	]);

	if (!user) {
		throw new Error("Authenticated user was not found");
	}

	return {
		exportedAt: new Date().toISOString(),
		profile: {
			...user,
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
		},
		organizationMemberships: organizationMemberships.map((membership) => ({
			id: membership.id,
			role: membership.role,
			createdAt: membership.createdAt.toISOString(),
			organization: {
				...membership.organization,
				createdAt: membership.organization.createdAt.toISOString(),
			},
		})),
		conversations: conversations.map((conversation) => ({
			...conversation,
			createdAt: conversation.createdAt.toISOString(),
			updatedAt: conversation.updatedAt.toISOString(),
			messages: conversation.messages.map((message) => ({
				...message,
				createdAt: message.createdAt.toISOString(),
				startedAt: message.startedAt?.toISOString() ?? null,
				completedAt: message.completedAt?.toISOString() ?? null,
				cancelledAt: message.cancelledAt?.toISOString() ?? null,
				lastChunkAt: message.lastChunkAt?.toISOString() ?? null,
				attachments: (message.attachments ?? []).map((attachment) => ({
					id: attachment.id,
					fileObjectId: attachment.fileObjectId,
					kind: attachment.kind,
					promptUse: attachment.promptUse,
					displayOrder: attachment.displayOrder,
					createdAt: attachment.createdAt.toISOString(),
					filename: attachment.fileObject.filename,
					mimeType: attachment.fileObject.mimeType,
					sizeBytes: attachment.fileObject.sizeBytes,
					status: attachment.fileObject.status,
					fileKind: attachment.fileObject.kind,
					purpose: attachment.fileObject.purpose,
				})),
			})),
			summaries: conversation.summaries.map((summary) => ({
				...summary,
				createdAt: summary.createdAt.toISOString(),
				updatedAt: summary.updatedAt.toISOString(),
			})),
		})),
		shares: shares.map((share) => ({
			...share,
			createdAt: share.createdAt.toISOString(),
			expiresAt: share.expiresAt?.toISOString() ?? null,
		})),
		feedback: feedback.map((item) => ({
			...item,
			createdAt: item.createdAt.toISOString(),
			updatedAt: item.updatedAt.toISOString(),
		})),
		usageEvents: usageEvents.map((usage) => ({
			...usage,
			estimatedCostUsd: usage.estimatedCostUsd?.toString() ?? null,
			startedAt: usage.startedAt.toISOString(),
			finalizedAt: usage.finalizedAt?.toISOString() ?? null,
			createdAt: usage.createdAt.toISOString(),
		})),
		quotaLedgers: quotaLedgers.map((ledger) => ({
			...ledger,
			usedUsd: ledger.usedUsd.toString(),
			windowStart: ledger.windowStart.toISOString(),
			windowEnd: ledger.windowEnd.toISOString(),
			createdAt: ledger.createdAt.toISOString(),
			updatedAt: ledger.updatedAt.toISOString(),
		})),
	};
}

export async function generateAccountExportFile(
	userId: string,
	format: AccountExportFormat
): Promise<AccountExportFile> {
	const exportData = await buildAccountExportData(userId);
	await auditAccountExportModeration(userId, exportData);

	if (format === "markdown") {
		return {
			content: formatMarkdownExport(exportData),
			contentType: "text/markdown; charset=utf-8",
			filename: getAccountExportFilename(format),
		};
	}

	return {
		content: JSON.stringify(exportData, null, 2),
		contentType: "application/json; charset=utf-8",
		filename: getAccountExportFilename(format),
	};
}
