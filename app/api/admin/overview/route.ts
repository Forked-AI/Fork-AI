import {
	adminAuditDelegate,
	operationalMetricDelegate,
	parseAdminDateWindow,
	requireAdminSession,
} from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});

function toNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
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

		const window = parseAdminDateWindow({
			from: parsed.data.from,
			to: parsed.data.to,
			defaultDays: 30,
		});
		if (!window.ok) return window.response;

		const where = { createdAt: { gte: window.from, lt: window.to } };
		const metricDelegate = operationalMetricDelegate();
		const auditDelegate = adminAuditDelegate();

		const [
			userCount,
			adminCount,
			bannedCount,
			waitlistCount,
			conversationCount,
			fileCounts,
			usageTotals,
			failedUsage,
			moderationCount,
			abuseCount,
			metricTotals,
			recentMetrics,
			recentAudit,
		] = await Promise.all([
			prisma.user.count(),
			prisma.user.count({ where: { role: "admin" } }),
			prisma.user.count({ where: { banned: true } }),
			prisma.waitlistEntry.count(),
			prisma.conversation.count(),
			prisma.fileObject.groupBy({
				by: ["status"],
				_count: { _all: true },
			}),
			prisma.usageEvent.aggregate({
				where,
				_count: { _all: true },
				_sum: {
					inputTokens: true,
					outputTokens: true,
					billableUnits: true,
					estimatedCostUsd: true,
				},
			}),
			prisma.usageEvent.count({
				where: {
					...where,
					outcome: { in: ["failed", "cancelled", "moderated"] },
				},
			}),
			prisma.moderationEvent.count({ where }),
			prisma.abuseSignal.count({ where }),
			metricDelegate.aggregate({
				where,
				_count: { _all: true },
				_avg: { durationMs: true, ttftMs: true, tokensPerSec: true },
			}),
			metricDelegate.findMany({
				where: { ...where, status: { not: "success" } },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: 8,
				select: {
					id: true,
					kind: true,
					source: true,
					status: true,
					route: true,
					job: true,
					provider: true,
					model: true,
					errorCode: true,
					providerStatus: true,
					createdAt: true,
				},
			}),
			auditDelegate.findMany({
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: 8,
				select: {
					id: true,
					action: true,
					targetType: true,
					targetId: true,
					createdAt: true,
					actor: { select: { email: true, name: true } },
				},
			}),
		]);

		return NextResponse.json({
			window: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
			},
			summary: {
				users: userCount,
				admins: adminCount,
				bannedUsers: bannedCount,
				waitlist: waitlistCount,
				conversations: conversationCount,
				usageEvents: usageTotals._count._all,
				failedUsageEvents: failedUsage,
				inputTokens: usageTotals._sum.inputTokens ?? 0,
				outputTokens: usageTotals._sum.outputTokens ?? 0,
				billableUnits: usageTotals._sum.billableUnits ?? 0,
				estimatedCostUsd:
					usageTotals._sum.estimatedCostUsd?.toString() ?? "0",
				moderationEvents: moderationCount,
				abuseSignals: abuseCount,
				operationalMetrics:
					(metricTotals._count as { _all?: number } | undefined)
						?._all ?? 0,
				averageDurationMs: Math.round(
					toNumber(
						(metricTotals._avg as { durationMs?: unknown })
							?.durationMs
					)
				),
				averageTtftMs: Math.round(
					toNumber(
						(metricTotals._avg as { ttftMs?: unknown })?.ttftMs
					)
				),
			},
			files: (
				fileCounts as Array<{
					status: string;
					_count: { _all: number };
				}>
			).map((row) => ({
				status: row.status,
				count: row._count._all,
			})),
			recentMetrics,
			recentAudit,
		});
	} catch (error) {
		logServerError("admin/overview", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch admin overview" },
			{ status: 500 }
		);
	}
}
