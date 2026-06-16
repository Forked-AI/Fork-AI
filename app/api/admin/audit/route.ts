import {
	adminAuditDelegate,
	parseAdminDateWindow,
	requireAdminSession,
} from "@/lib/admin";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	action: z.string().trim().max(120).optional(),
	targetType: z.string().trim().max(120).optional(),
	actor: z.string().trim().max(320).optional(),
	cursor: z.string().trim().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

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

		const where = {
			createdAt: { gte: window.from, lt: window.to },
			...(parsed.data.action
				? {
						action: {
							contains: parsed.data.action,
							mode: "insensitive",
						},
					}
				: {}),
			...(parsed.data.targetType
				? { targetType: parsed.data.targetType }
				: {}),
			...(parsed.data.actor
				? {
						actor: {
							is: {
								OR: [
									{ id: parsed.data.actor },
									{
										email: {
											contains: parsed.data.actor,
											mode: "insensitive",
										},
									},
								],
							},
						},
					}
				: {}),
		};
		const delegate = adminAuditDelegate();
		const [events, total] = await Promise.all([
			delegate.findMany({
				where,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: parsed.data.limit + 1,
				...(parsed.data.cursor
					? { cursor: { id: parsed.data.cursor }, skip: 1 }
					: {}),
				select: {
					id: true,
					actorId: true,
					action: true,
					targetType: true,
					targetId: true,
					requestId: true,
					idempotencyKey: true,
					metadataJson: true,
					createdAt: true,
					actor: { select: { email: true, name: true } },
				},
			}),
			delegate.count({ where }),
		]);
		const rows = events as Array<{ id: string }>;
		const hasMore = rows.length > parsed.data.limit;
		const page = hasMore ? rows.slice(0, parsed.data.limit) : rows;

		return NextResponse.json({
			window: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
			},
			total,
			events: page,
			nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
		});
	} catch (error) {
		logServerError("admin/audit", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch audit events" },
			{ status: 500 }
		);
	}
}
