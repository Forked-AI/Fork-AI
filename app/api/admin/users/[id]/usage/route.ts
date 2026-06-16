import { parseAdminDateWindow, requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id } = await params;
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

		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, email: true, name: true },
		});
		if (!user) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 }
			);
		}

		const where = {
			userId: id,
			createdAt: { gte: window.from, lt: window.to },
		};
		const [totals, byProvider, byOutcome, recentEvents, quotaRows] =
			await Promise.all([
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
				prisma.usageEvent.groupBy({
					by: ["provider", "resolvedModel", "requestedModel"],
					where,
					_count: { _all: true },
					_sum: {
						billableUnits: true,
						estimatedCostUsd: true,
					},
				}),
				prisma.usageEvent.groupBy({
					by: ["outcome"],
					where,
					_count: { _all: true },
					_sum: { billableUnits: true },
				}),
				prisma.usageEvent.findMany({
					where,
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					take: 20,
					select: {
						id: true,
						conversationId: true,
						messageId: true,
						generationId: true,
						feature: true,
						outcome: true,
						provider: true,
						requestedModel: true,
						resolvedModel: true,
						billableUnits: true,
						estimatedCostUsd: true,
						usageSource: true,
						errorCode: true,
						providerStatusCode: true,
						createdAt: true,
					},
				}),
				prisma.quotaLedger.findMany({
					where: {
						subjectType: "user",
						subjectId: id,
					},
					orderBy: { windowStart: "desc" },
					take: 12,
					select: {
						windowStart: true,
						windowEnd: true,
						usedTokens: true,
						usedUsd: true,
					},
				}),
			]);

		return NextResponse.json({
			user,
			window: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
			},
			totals: {
				events: totals._count._all,
				inputTokens: totals._sum.inputTokens ?? 0,
				outputTokens: totals._sum.outputTokens ?? 0,
				billableUnits: totals._sum.billableUnits ?? 0,
				estimatedCostUsd:
					totals._sum.estimatedCostUsd?.toString() ?? "0",
			},
			breakdowns: {
				byProvider: byProvider.map((row) => ({
					provider: row.provider,
					model: row.resolvedModel ?? row.requestedModel,
					events: row._count._all,
					billableUnits: row._sum.billableUnits ?? 0,
					estimatedCostUsd:
						row._sum.estimatedCostUsd?.toString() ?? "0",
				})),
				byOutcome: byOutcome.map((row) => ({
					outcome: row.outcome,
					events: row._count._all,
					billableUnits: row._sum.billableUnits ?? 0,
				})),
			},
			quotaRows: quotaRows.map((row) => ({
				...row,
				usedUsd: row.usedUsd.toString(),
			})),
			recentEvents: recentEvents.map((event) => ({
				...event,
				estimatedCostUsd: event.estimatedCostUsd?.toString() ?? null,
			})),
		});
	} catch (error) {
		logServerError("admin/users/usage", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch user usage" },
			{ status: 500 }
		);
	}
}
