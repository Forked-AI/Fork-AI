import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	user: z.string().trim().max(320).optional(),
	provider: z.string().trim().max(80).optional(),
	model: z.string().trim().max(160).optional(),
	outcome: z
		.enum(["pending", "completed", "failed", "cancelled", "moderated"])
		.optional(),
	cursor: z.string().trim().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

function getDefaultWindow() {
	const now = new Date();
	return {
		from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
		to: now,
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

		const where = {
			createdAt: { gte: from, lt: to },
			...(parsed.data.user
				? {
						user: {
							is: {
								OR: [
									{ id: parsed.data.user },
									{
										email: {
											contains: parsed.data.user,
											mode: "insensitive" as const,
										},
									},
								],
							},
						},
					}
				: {}),
			...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
			...(parsed.data.model
				? {
						OR: [
							{ requestedModel: parsed.data.model },
							{ resolvedModel: parsed.data.model },
						],
					}
				: {}),
			...(parsed.data.outcome ? { outcome: parsed.data.outcome } : {}),
		};

		const [events, totals, byProvider, byOutcome, byFeature] =
			await Promise.all([
				prisma.usageEvent.findMany({
					where,
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					take: parsed.data.limit + 1,
					...(parsed.data.cursor
						? { cursor: { id: parsed.data.cursor }, skip: 1 }
						: {}),
					select: {
						id: true,
						userId: true,
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
						user: { select: { email: true, name: true } },
					},
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
				prisma.usageEvent.groupBy({
					by: ["feature"],
					where,
					_count: { _all: true },
					_sum: { billableUnits: true },
				}),
			]);

		const hasMore = events.length > parsed.data.limit;
		const page = hasMore ? events.slice(0, parsed.data.limit) : events;

		return NextResponse.json({
			window: { from: from.toISOString(), to: to.toISOString() },
			totals: {
				events: totals._count._all,
				inputTokens: totals._sum.inputTokens ?? 0,
				outputTokens: totals._sum.outputTokens ?? 0,
				billableUnits: totals._sum.billableUnits ?? 0,
				estimatedCostUsd:
					totals._sum.estimatedCostUsd?.toString() ?? "0",
			},
			events: page.map((event) => ({
				...event,
				estimatedCostUsd: event.estimatedCostUsd?.toString() ?? null,
			})),
			breakdowns: {
				byProvider: byProvider
					.map((row) => ({
						provider: row.provider,
						model: row.resolvedModel ?? row.requestedModel,
						events: row._count._all,
						billableUnits: row._sum.billableUnits ?? 0,
						estimatedCostUsd:
							row._sum.estimatedCostUsd?.toString() ?? "0",
					}))
					.sort((left, right) => right.events - left.events)
					.slice(0, 12),
				byOutcome: byOutcome.map((row) => ({
					outcome: row.outcome,
					events: row._count._all,
					billableUnits: row._sum.billableUnits ?? 0,
				})),
				byFeature: byFeature.map((row) => ({
					feature: row.feature,
					events: row._count._all,
					billableUnits: row._sum.billableUnits ?? 0,
				})),
			},
			nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
		});
	} catch (error) {
		logServerError("admin/usage", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch usage" },
			{ status: 500 }
		);
	}
}
