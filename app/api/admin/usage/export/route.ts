import {
	getIdempotencyKey,
	recordAdminAuditEvent,
	requireAdminSession,
} from "@/lib/admin";
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
	limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

function csvCell(value: unknown) {
	const text = value === null || value === undefined ? "" : String(value);
	return `"${text.replaceAll('"', '""')}"`;
}

function getDefaultWindow() {
	const now = new Date();
	return {
		from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
		to: now,
	};
}

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	if (!getIdempotencyKey(request)) {
		return NextResponse.json(
			{
				error: "Idempotency-Key header is required.",
				errorCode: "IDEMPOTENCY_KEY_REQUIRED",
			},
			{ status: 400 }
		);
	}

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

		const events = await prisma.usageEvent.findMany({
			where,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: parsed.data.limit,
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
				user: { select: { email: true } },
			},
		});

		await recordAdminAuditEvent({
			actorId: admin.session.user.id,
			action: "usage.export",
			targetType: "usage_event",
			request,
			metadata: {
				rowCount: events.length,
				from: from.toISOString(),
				to: to.toISOString(),
			},
		});

		const headers = [
			"id",
			"createdAt",
			"user",
			"userId",
			"conversationId",
			"messageId",
			"generationId",
			"feature",
			"outcome",
			"provider",
			"requestedModel",
			"resolvedModel",
			"promptVersion",
			"providerRequestId",
			"inputTokens",
			"outputTokens",
			"billableUnits",
			"usageSource",
			"estimatedCostUsd",
			"costIsEstimate",
			"pricingVersion",
			"errorCode",
			"providerStatusCode",
			"startedAt",
			"finalizedAt",
		];
		const rows = events.map((event) =>
			[
				event.id,
				event.createdAt.toISOString(),
				event.user?.email ?? "",
				event.userId,
				event.conversationId,
				event.messageId,
				event.generationId,
				event.feature,
				event.outcome,
				event.provider,
				event.requestedModel,
				event.resolvedModel,
				event.promptVersion,
				event.providerRequestId,
				event.inputTokens,
				event.outputTokens,
				event.billableUnits,
				event.usageSource,
				event.estimatedCostUsd?.toString() ?? "",
				event.costIsEstimate,
				event.pricingVersion,
				event.errorCode,
				event.providerStatusCode,
				event.startedAt.toISOString(),
				event.finalizedAt?.toISOString() ?? "",
			]
				.map(csvCell)
				.join(",")
		);
		const csv = [headers.join(","), ...rows].join("\n");

		return new NextResponse(csv, {
			status: 200,
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="usage-export-${
					new Date().toISOString().split("T")[0]
				}.csv"`,
			},
		});
	} catch (error) {
		logServerError("admin/usage/export", "export_failed", error);
		return NextResponse.json(
			{ error: "Failed to export usage" },
			{ status: 500 }
		);
	}
}
