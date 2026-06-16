import { prisma } from "@/lib/prisma";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import type { ToolPrismaClient } from "@/lib/tools/types";

const DEFAULT_RUNNING_STALE_MS = 2 * 60 * 1000;
const DEFAULT_CONFIRMATION_STALE_MS = 24 * 60 * 60 * 1000;

function positiveInteger(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getToolReconciliationConfig() {
	return {
		runningStaleMs: positiveInteger(
			process.env.TOOL_RUNNING_STALE_MS,
			DEFAULT_RUNNING_STALE_MS
		),
		confirmationStaleMs: positiveInteger(
			process.env.TOOL_CONFIRMATION_STALE_MS,
			DEFAULT_CONFIRMATION_STALE_MS
		),
		intervalMs: positiveInteger(
			process.env.TOOL_RECONCILIATION_INTERVAL_MS,
			60_000
		),
	};
}

export async function reconcileStaleToolExecutions(
	options: {
		prismaClient?: ToolPrismaClient;
		now?: Date;
		runningStaleMs?: number;
		confirmationStaleMs?: number;
	} = {}
) {
	const prismaClient =
		options.prismaClient ?? (prisma as unknown as ToolPrismaClient);
	const now = options.now ?? new Date();
	const config = getToolReconciliationConfig();
	const runningCutoff = new Date(
		now.getTime() - (options.runningStaleMs ?? config.runningStaleMs)
	);
	const confirmationCutoff = new Date(
		now.getTime() -
			(options.confirmationStaleMs ?? config.confirmationStaleMs)
	);

	const [running, pending] = await Promise.all([
		prismaClient.toolExecution.updateMany({
			where: {
				status: "running",
				startedAt: { lt: runningCutoff },
			},
			data: {
				status: "timed_out",
				errorCode: "TOOL_EXECUTION_ABANDONED",
				completedAt: now,
				auditMetadata: {
					reconciled: true,
					reason: "stale_running_execution",
				},
			},
		}),
		prismaClient.toolExecution.updateMany({
			where: {
				status: "pending_confirmation",
				createdAt: { lt: confirmationCutoff },
			},
			data: {
				status: "cancelled",
				errorCode: "TOOL_CONFIRMATION_EXPIRED",
				completedAt: now,
				auditMetadata: {
					reconciled: true,
					reason: "confirmation_expired",
				},
			},
		}),
	]);

	if (running.count > 0 || pending.count > 0) {
		logServerInfo("tools/reconciliation", "completed", {
			staleRunningCount: running.count,
			expiredConfirmationCount: pending.count,
		});
	}

	return {
		staleRunningCount: running.count,
		expiredConfirmationCount: pending.count,
	};
}

export async function runToolReconciliationSafely() {
	try {
		return await reconcileStaleToolExecutions();
	} catch (error) {
		logServerError("tools/reconciliation", "failed", error);
		return null;
	}
}
