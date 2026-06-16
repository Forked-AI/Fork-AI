import { Worker } from "bullmq";
import { generateConversationSummary } from "../lib/conversations/generate-summary";
import { generateConversationTitle } from "../lib/conversations/generate-title";
import { recordOperationalMetric } from "../lib/operational-metrics";
import { queueConnection } from "../lib/queue/connection";
import type {
	ConversationQueueJobData,
	ConversationQueueJobName,
} from "../lib/queue/conversation";
import { logServerError, logServerInfo } from "../lib/server-safe-log";

export const conversationWorker = new Worker<
	ConversationQueueJobData,
	void,
	ConversationQueueJobName
>(
	"conversation",
	async (job) => {
		if (job.name === "generate-title") {
			const result = await generateConversationTitle(job.data);
			await recordOperationalMetric({
				kind: "queue_job",
				source: "conversation",
				status: "success",
				job: job.name,
				durationMs: job.processedOn
					? Date.now() - job.processedOn
					: null,
				userId: job.data.userId,
				conversationId: result.conversationId,
				traceId: job.id,
			});
			logServerInfo("workers/conversation", "title_generated", {
				jobId: job.id,
				conversationId: result.conversationId,
			});
			return;
		}

		if (job.name === "summarize-conversation") {
			const result = await generateConversationSummary(job.data);
			await recordOperationalMetric({
				kind: "queue_job",
				source: "conversation",
				status: "success",
				job: job.name,
				durationMs: job.processedOn
					? Date.now() - job.processedOn
					: null,
				userId: job.data.userId,
				conversationId: result.conversationId,
				traceId: job.id,
				metadata: {
					summaryId: result.id,
					sourceMessageCount: result.sourceMessageCount,
				},
			});
			logServerInfo("workers/conversation", "summary_generated", {
				jobId: job.id,
				conversationId: result.conversationId,
				summaryId: result.id,
				contextVersion: result.promptVersion,
				sourceMessageCount: result.sourceMessageCount,
			});
		}
	},
	{ connection: queueConnection }
);

conversationWorker.on("failed", (job, error) => {
	void recordOperationalMetric({
		kind: "queue_job",
		source: "conversation",
		status: "failed",
		job: job?.name ?? null,
		durationMs: job?.processedOn ? Date.now() - job.processedOn : null,
		userId: job?.data?.userId ?? null,
		conversationId: job?.data?.conversationId ?? null,
		traceId: job?.id,
		errorCode: error.name,
		metadata: { message: error.message },
	});
	logServerError("workers/conversation", "job_failed", error, {
		jobId: job?.id,
		jobName: job?.name,
	});
});
