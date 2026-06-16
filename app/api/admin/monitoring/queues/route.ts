import { requireAdminSession } from "@/lib/admin";
import { accountExportQueue } from "@/lib/queue/account-export";
import { conversationQueue } from "@/lib/queue/conversation";
import { fileProcessingQueue } from "@/lib/queue/file-processing";
import { logServerError } from "@/lib/server-safe-log";
import { evaluateQueueAlerts } from "@/lib/operational-alerts";
import { NextResponse } from "next/server";

const queues = {
	conversation: conversationQueue,
	"account-export": accountExportQueue,
	"file-processing": fileProcessingQueue,
} as const;

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const snapshots = await Promise.all(
			Object.entries(queues).map(async ([name, queue]) => {
				const [counts, failed, waiting, active, delayed] =
					await Promise.all([
						queue.getJobCounts(
							"waiting",
							"active",
							"completed",
							"failed",
							"delayed",
							"paused"
						),
						queue.getFailed(0, 4),
						queue.getWaiting(0, 4),
						queue.getActive(0, 4),
						queue.getDelayed(0, 4),
					]);

				return {
					name,
					counts,
					jobs: {
						failed: failed.map((job) => ({
							id: job.id,
							name: job.name,
							attemptsMade: job.attemptsMade,
							failedReason: job.failedReason,
							timestamp: job.timestamp,
							processedOn: job.processedOn,
							finishedOn: job.finishedOn,
						})),
						waiting: waiting.map((job) => ({
							id: job.id,
							name: job.name,
							timestamp: job.timestamp,
						})),
						active: active.map((job) => ({
							id: job.id,
							name: job.name,
							timestamp: job.timestamp,
							processedOn: job.processedOn,
						})),
						delayed: delayed.map((job) => ({
							id: job.id,
							name: job.name,
							timestamp: job.timestamp,
							delay: job.delay,
						})),
					},
				};
			})
		);

		return NextResponse.json({
			queues: snapshots,
			alerts: evaluateQueueAlerts(snapshots),
		});
	} catch (error) {
		logServerError("admin/monitoring/queues", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch queue health" },
			{ status: 500 }
		);
	}
}
