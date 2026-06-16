import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const moderationActions = ["allow", "block", "review", "degrade"] as const;
const moderationCategories = [
	"none",
	"child_safety",
	"violence",
	"self_harm",
	"sexual_content",
	"hate_harassment",
	"illegal_activity",
	"malware",
	"credential_exfiltration",
	"prompt_injection",
	"privacy_spam",
	"file_risk",
	"provider_abuse",
	"signup_abuse",
	"output_risk",
] as const;
const moderationSources = [
	"chat_message",
	"file_upload",
	"assistant_output",
	"share_snapshot",
	"account_export",
	"signup",
	"rate_limit",
	"provider_response",
] as const;
const abuseSignalTypes = [
	"prompt_flooding",
	"token_draining",
	"provider_rate_limit",
	"high_failure_rate",
	"suspicious_signup",
	"moderation_block",
	"rate_limit_exceeded",
	"file_scanner_block",
] as const;

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	user: z.string().trim().max(320).optional(),
	category: z.enum(moderationCategories).optional(),
	action: z.enum(moderationActions).optional(),
	source: z.enum(moderationSources).optional(),
	signalType: z.enum(abuseSignalTypes).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

function getDefaultWindow() {
	const now = new Date();
	return {
		from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
		to: now,
	};
}

function buildUserFilter(user: string | undefined) {
	if (!user) return {};

	return {
		user: {
			is: {
				OR: [
					{ id: user },
					{
						email: {
							contains: user,
							mode: "insensitive" as const,
						},
					},
				],
			},
		},
	};
}

export async function GET(request: Request) {
	try {
		const admin = await requireAdminSession(request);
		if (!admin.ok) return admin.response;

		const url = new URL(request.url);
		const parsed = querySchema.safeParse(
			Object.fromEntries(url.searchParams.entries())
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid query", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const defaults = getDefaultWindow();
		const from = parsed.data.from
			? new Date(parsed.data.from)
			: defaults.from;
		const to = parsed.data.to ? new Date(parsed.data.to) : defaults.to;
		if (from >= to) {
			return NextResponse.json(
				{ error: "The from date must be before the to date." },
				{ status: 400 }
			);
		}

		const userFilter = buildUserFilter(parsed.data.user);
		const eventWhere = {
			createdAt: { gte: from, lt: to },
			...userFilter,
			...(parsed.data.category ? { category: parsed.data.category } : {}),
			...(parsed.data.action ? { action: parsed.data.action } : {}),
			...(parsed.data.source ? { source: parsed.data.source } : {}),
		};
		const signalWhere = {
			createdAt: { gte: from, lt: to },
			...userFilter,
			...(parsed.data.action ? { action: parsed.data.action } : {}),
			...(parsed.data.signalType
				? { signalType: parsed.data.signalType }
				: {}),
		};

		const [events, signals, eventCount, signalCount] = await Promise.all([
			prisma.moderationEvent.findMany({
				where: eventWhere,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: parsed.data.limit,
				select: {
					id: true,
					userId: true,
					conversationId: true,
					messageId: true,
					fileObjectId: true,
					sharedConversationId: true,
					source: true,
					stage: true,
					category: true,
					action: true,
					severity: true,
					policyVersion: true,
					reason: true,
					contentHash: true,
					contentLength: true,
					matchedRuleIds: true,
					metadataJson: true,
					createdAt: true,
					user: { select: { email: true, name: true } },
				},
			}),
			prisma.abuseSignal.findMany({
				where: signalWhere,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: parsed.data.limit,
				select: {
					id: true,
					userId: true,
					conversationId: true,
					signalType: true,
					severity: true,
					action: true,
					actorHash: true,
					count: true,
					windowSeconds: true,
					provider: true,
					model: true,
					providerStatusCode: true,
					metadataJson: true,
					createdAt: true,
					user: { select: { email: true, name: true } },
				},
			}),
			prisma.moderationEvent.count({ where: eventWhere }),
			prisma.abuseSignal.count({ where: signalWhere }),
		]);

		return NextResponse.json({
			window: { from: from.toISOString(), to: to.toISOString() },
			totals: {
				moderationEvents: eventCount,
				abuseSignals: signalCount,
			},
			events,
			signals,
		});
	} catch (error) {
		logServerError("admin/moderation", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch moderation report" },
			{ status: 500 }
		);
	}
}
