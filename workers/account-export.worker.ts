import { generateAccountExportFile } from "@/lib/account-export";
import { recordOperationalMetric } from "@/lib/operational-metrics";
import { queueConnection } from "@/lib/queue/connection";
import type {
	AccountExportQueueJobData,
	AccountExportQueueJobName,
	AccountExportQueueJobResult,
} from "@/lib/queue/account-export";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { Worker } from "bullmq";

export const accountExportWorker = new Worker<
	AccountExportQueueJobData,
	AccountExportQueueJobResult,
	AccountExportQueueJobName
>(
	"account-export",
	async (job) => {
		if (job.name !== "generate-account-export") {
			throw new Error(`Unknown account export job: ${job.name}`);
		}

		const file = await generateAccountExportFile(
			job.data.userId,
			job.data.format
		);
		await recordOperationalMetric({
			kind: "queue_job",
			source: "account-export",
			status: "success",
			job: job.name,
			durationMs: job.processedOn ? Date.now() - job.processedOn : null,
			userId: job.data.userId,
			traceId: job.id,
			metadata: {
				format: job.data.format,
				contentType: file.contentType,
			},
		});

		logServerInfo("workers/account-export", "export_generated", {
			jobId: job.id,
			format: job.data.format,
			userId: job.data.userId,
		});

		return file;
	},
	{ connection: queueConnection }
);

accountExportWorker.on("failed", (job, error) => {
	void recordOperationalMetric({
		kind: "queue_job",
		source: "account-export",
		status: "failed",
		job: job?.name ?? null,
		durationMs: job?.processedOn ? Date.now() - job.processedOn : null,
		userId: job?.data?.userId ?? null,
		traceId: job?.id,
		errorCode: error.name,
		metadata: { message: error.message },
	});
	logServerError("workers/account-export", "job_failed", error, {
		jobId: job?.id,
		jobName: job?.name,
	});
});
