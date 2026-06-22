import {
	processUploadedFile,
	reindexFileEmbeddings,
} from "@/lib/rag/processing-service";
import { recordOperationalMetric } from "@/lib/operational-metrics";
import { queueConnection } from "@/lib/queue/connection";
import type {
	FileProcessingQueueJobData,
	FileProcessingQueueJobName,
} from "@/lib/queue/file-processing";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { Worker } from "bullmq";

export const fileProcessingWorker = new Worker<
	FileProcessingQueueJobData,
	void,
	FileProcessingQueueJobName
>(
	"file-processing",
	async (job) => {
		if (
			job.name !== "process-uploaded-file" &&
			job.name !== "reindex-file-embeddings"
		) {
			throw new Error(`Unknown file-processing job: ${job.name}`);
		}

		const result =
			job.name === "process-uploaded-file"
				? await processUploadedFile(job.data)
				: await reindexFileEmbeddings(job.data);
		await recordOperationalMetric({
			kind: "queue_job",
			source: "file-processing",
			status: "success",
			job: job.name,
			durationMs: job.processedOn ? Date.now() - job.processedOn : null,
			userId: job.data.userId,
			traceId: job.id,
			metadata: {
				fileId: result.fileId,
				chunkCount: result.chunkCount,
			},
		});
		logServerInfo("workers/file-processing", "file_processed", {
			jobId: job.id,
			fileId: result.fileId,
			chunkCount: result.chunkCount,
		});
	},
	{ connection: queueConnection }
);

fileProcessingWorker.on("failed", (job, error) => {
	void recordOperationalMetric({
		kind: "queue_job",
		source: "file-processing",
		status: "failed",
		job: job?.name ?? null,
		durationMs: job?.processedOn ? Date.now() - job.processedOn : null,
		userId: job?.data?.userId ?? null,
		traceId: job?.id,
		errorCode: error.name,
		metadata: {
			message: error.message,
			fileId: job?.data?.fileId,
		},
	});
	logServerError("workers/file-processing", "job_failed", error, {
		jobId: job?.id,
		jobName: job?.name,
	});
});
