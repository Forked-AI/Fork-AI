import { parseAdminDateWindow, requireAdminSession } from "@/lib/admin";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { summarizeStoredToolResult } from "@/lib/tools/sanitizer";
import type { ToolJsonValue } from "@/lib/tools/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const toolExecutionStatusSchema = z.enum([
	"pending_confirmation",
	"cancelled",
	"running",
	"succeeded",
	"failed",
	"unauthorized",
	"invalid_input",
	"timed_out",
]);

const querySchema = z.object({
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	toolName: z.string().trim().max(120).optional(),
	status: toolExecutionStatusSchema.optional(),
	userId: z.string().trim().max(120).optional(),
	conversationId: z.string().trim().max(120).optional(),
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
			defaultDays: 7,
		});
		if (!window.ok) return window.response;

		const where: Prisma.ToolExecutionWhereInput = {
			createdAt: { gte: window.from, lt: window.to },
			...(parsed.data.toolName ? { toolName: parsed.data.toolName } : {}),
			...(parsed.data.status ? { status: parsed.data.status } : {}),
			...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
			...(parsed.data.conversationId
				? { conversationId: parsed.data.conversationId }
				: {}),
		};

		const [executions, total, byStatus, byTool] = await Promise.all([
			prisma.toolExecution.findMany({
				where,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: parsed.data.limit,
				select: {
					id: true,
					userId: true,
					organizationId: true,
					conversationId: true,
					messageId: true,
					toolName: true,
					status: true,
					riskLevel: true,
					requiresConfirmation: true,
					confirmedAt: true,
					inputSummaryJson: true,
					resultSummaryJson: true,
					auditMetadata: true,
					errorCode: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			prisma.toolExecution.count({ where }),
			prisma.toolExecution.groupBy({
				by: ["status"],
				where,
				_count: { _all: true },
			}),
			prisma.toolExecution.groupBy({
				by: ["toolName"],
				where,
				_count: { _all: true },
			}),
		]);

		const safeExecutions = executions.map(
			({ resultSummaryJson, ...execution }) => ({
				...execution,
				resultSummary: summarizeStoredToolResult(
					resultSummaryJson as ToolJsonValue | null
				),
			})
		);

		return NextResponse.json({
			window: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
			},
			total,
			breakdowns: { byStatus, byTool },
			executions: safeExecutions,
		});
	} catch (error) {
		logServerError("admin/tools", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch tool executions" },
			{ status: 500 }
		);
	}
}
