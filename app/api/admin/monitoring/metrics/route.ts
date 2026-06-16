import {
	operationalMetricDelegate,
	parseAdminDateWindow,
	requireAdminSession,
} from "@/lib/admin";
import { logServerError } from "@/lib/server-safe-log";
import { evaluateMetricAlerts } from "@/lib/operational-alerts";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	kind: z.string().trim().max(80).optional(),
	source: z.string().trim().max(120).optional(),
	status: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

function metricNumber(value: unknown) {
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
			defaultDays: 7,
		});
		if (!window.ok) return window.response;

		const where = {
			createdAt: { gte: window.from, lt: window.to },
			...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
			...(parsed.data.source ? { source: parsed.data.source } : {}),
			...(parsed.data.status ? { status: parsed.data.status } : {}),
		};
		const delegate = operationalMetricDelegate();

		const [
			totals,
			byKind,
			byStatus,
			byRoute,
			byProvider,
			byJob,
			recent,
			generationCount,
			failureCount,
			provider429Count,
		] = await Promise.all([
			delegate.aggregate({
				where,
				_count: { _all: true },
				_avg: {
					durationMs: true,
					ttftMs: true,
					tokensPerSec: true,
				},
				_sum: {
					totalTokens: true,
					costTotal: true,
				},
			}),
			delegate.groupBy({
				by: ["kind", "source"],
				where,
				_count: { _all: true },
				_avg: { durationMs: true },
			}),
			delegate.groupBy({
				by: ["status"],
				where,
				_count: { _all: true },
			}),
			delegate.groupBy({
				by: ["route"],
				where: { ...where, route: { not: null } },
				_count: { _all: true },
				_avg: { durationMs: true },
			}),
			delegate.groupBy({
				by: ["provider", "model"],
				where: { ...where, provider: { not: null } },
				_count: { _all: true },
				_avg: {
					durationMs: true,
					ttftMs: true,
					tokensPerSec: true,
				},
			}),
			delegate.groupBy({
				by: ["job"],
				where: { ...where, job: { not: null } },
				_count: { _all: true },
				_avg: { durationMs: true },
			}),
			delegate.findMany({
				where,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: parsed.data.limit,
				select: {
					id: true,
					kind: true,
					source: true,
					status: true,
					route: true,
					job: true,
					provider: true,
					model: true,
					durationMs: true,
					ttftMs: true,
					tokensPerSec: true,
					totalTokens: true,
					costTotal: true,
					errorCode: true,
					providerStatus: true,
					userId: true,
					conversationId: true,
					traceId: true,
					createdAt: true,
				},
			}),
			delegate.count({
				where: { ...where, kind: "ai_generation" },
			}),
			delegate.count({
				where: {
					...where,
					kind: "ai_generation",
					status: "failed",
				},
			}),
			delegate.count({
				where: {
					...where,
					kind: "ai_generation",
					providerStatus: 429,
				},
			}),
		]);
		const costTotal =
			(totals._sum as { costTotal?: number | null } | undefined)
				?.costTotal ?? 0;

		return NextResponse.json({
			window: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
			},
			totals: {
				events:
					(totals._count as { _all?: number } | undefined)?._all ?? 0,
				averageDurationMs: Math.round(
					metricNumber(
						(totals._avg as { durationMs?: unknown })?.durationMs
					)
				),
				averageTtftMs: Math.round(
					metricNumber((totals._avg as { ttftMs?: unknown })?.ttftMs)
				),
				averageTokensPerSec: metricNumber(
					(totals._avg as { tokensPerSec?: unknown })?.tokensPerSec
				),
				totalTokens:
					(totals._sum as { totalTokens?: number | null } | undefined)
						?.totalTokens ?? 0,
				costTotal,
				generationCount,
				failureCount,
				provider429Count,
			},
			alerts: evaluateMetricAlerts({
				generationCount,
				failureCount,
				provider429Count,
				costTotal,
			}),
			breakdowns: {
				byKind,
				byStatus,
				byRoute,
				byProvider,
				byJob,
			},
			recent,
		});
	} catch (error) {
		logServerError("admin/monitoring/metrics", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch operational metrics" },
			{ status: 500 }
		);
	}
}
