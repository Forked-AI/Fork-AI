import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export type FileProcessingQueueJobName =
	| "process-uploaded-file"
	| "reindex-file-embeddings";

export interface ProcessUploadedFileJobData {
	fileId: string;
	userId: string;
}

export type ReindexFileEmbeddingsJobData = ProcessUploadedFileJobData;

export type FileProcessingQueueJobData =
	| ProcessUploadedFileJobData
	| ReindexFileEmbeddingsJobData;

export const fileProcessingQueue = new Queue<
	FileProcessingQueueJobData,
	void,
	FileProcessingQueueJobName
>("file-processing", {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 1000,
		},
		removeOnComplete: 100,
		removeOnFail: 500,
	},
});

export function enqueueUploadedFileProcessingJob(
	options: ProcessUploadedFileJobData
) {
	return fileProcessingQueue.add("process-uploaded-file", options, {
		jobId: `process-uploaded-file:${options.userId}:${options.fileId}`,
	});
}

export function enqueueFileEmbeddingReindexJob(
	options: ReindexFileEmbeddingsJobData
) {
	return fileProcessingQueue.add("reindex-file-embeddings", options, {
		jobId: `reindex-file-embeddings:${options.userId}:${options.fileId}`,
	});
}
