import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { accountExportQueue } from "@/lib/queue/account-export";
import { conversationQueue } from "@/lib/queue/conversation";
import { fileProcessingQueue } from "@/lib/queue/file-processing";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

const queues = {
	conversation: conversationQueue,
	"account-export": accountExportQueue,
	"file-processing": fileProcessingQueue,
} as const;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ queue: string; jobId: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { queue: queueName, jobId } = await params;
		const queue = queues[queueName as keyof typeof queues];
		if (!queue) {
			return NextResponse.json(
				{ error: "Unknown queue" },
				{ status: 404 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:queue:retry",
				actorKey: `admin:${admin.session.user.id}`,
				requestInput: { queueName, jobId },
			},
			async () => {
				const job = await queue.getJob(jobId);
				if (!job) {
					return { body: { error: "Job not found" }, status: 404 };
				}

				await job.retry();
				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "queue.retry",
					targetType: "queue_job",
					targetId: `${queueName}:${jobId}`,
					request,
					metadata: {
						queue: queueName,
						jobName: job.name,
						attemptsMade: job.attemptsMade,
					},
				});

				return {
					body: { ok: true, queue: queueName, jobId },
					resourceType: "queue_job",
					resourceId: `${queueName}:${jobId}`,
				};
			}
		);
	} catch (error) {
		logServerError("admin/monitoring/queues", "retry_failed", error);
		return NextResponse.json(
			{ error: "Failed to retry queue job" },
			{ status: 500 }
		);
	}
}
