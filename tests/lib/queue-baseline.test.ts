import { describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
	Queue: vi.fn(function Queue(name, options) {
		return {
			name,
			options,
			add: vi.fn(async (jobName, data, jobOptions) => ({
				id: jobOptions?.jobId ?? `${name}:${jobName}`,
				name: jobName,
				data,
				jobOptions,
			})),
		};
	}),
}));

vi.mock("bullmq", () => ({
	Queue: queueMocks.Queue,
}));

vi.mock("@/lib/queue/connection", () => ({
	queueConnection: { host: "redis.test" },
}));

describe("queue baseline configuration", () => {
	it("configures account export queue retry and retention defaults", async () => {
		const { accountExportQueue } =
			await import("@/lib/queue/account-export");

		expect(accountExportQueue.name).toBe("account-export");
		expect((accountExportQueue as any).options.defaultJobOptions).toMatchObject({
			attempts: 2,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
			removeOnComplete: {
				age: 60 * 60,
				count: 100,
			},
			removeOnFail: 500,
		});
	});

	it("enqueues account export jobs with user, format, and stable job name", async () => {
		const { accountExportQueue, enqueueAccountExportJob } =
			await import("@/lib/queue/account-export");

		await enqueueAccountExportJob({
			userId: "user-1",
			format: "json",
		});

		expect(accountExportQueue.add).toHaveBeenCalledWith(
			"generate-account-export",
			{
				userId: "user-1",
				format: "json",
			},
			{
				jobId: expect.stringMatching(
					/^account-export:user-1:json:\d+$/
				),
			}
		);
	});

	it("configures conversation title queue retry and retention defaults", async () => {
		const { conversationQueue } = await import("@/lib/queue/conversation");

		expect(conversationQueue.name).toBe("conversation");
		expect((conversationQueue as any).options.defaultJobOptions).toMatchObject({
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
			removeOnComplete: 100,
			removeOnFail: 500,
		});
	});

	it("enqueues conversation summary jobs with a stable conversation job id", async () => {
		const { conversationQueue, enqueueConversationSummaryJob } =
			await import("@/lib/queue/conversation");

		await enqueueConversationSummaryJob({
			userId: "user-1",
			conversationId: "conversation-1",
		});

		expect(conversationQueue.add).toHaveBeenCalledWith(
			"summarize-conversation",
			{
				userId: "user-1",
				conversationId: "conversation-1",
			},
			{
				jobId: "summarize-conversation:user-1:conversation-1",
			}
		);
	});

	it("configures file-processing queue retry and retention defaults", async () => {
		const { fileProcessingQueue } = await import(
			"@/lib/queue/file-processing"
		);

		expect(fileProcessingQueue.name).toBe("file-processing");
		expect((fileProcessingQueue as any).options.defaultJobOptions).toMatchObject({
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
			removeOnComplete: 100,
			removeOnFail: 500,
		});
	});

	it("enqueues uploaded file processing with a stable file job id", async () => {
		const { fileProcessingQueue, enqueueUploadedFileProcessingJob } =
			await import("@/lib/queue/file-processing");

		await enqueueUploadedFileProcessingJob({
			userId: "user-1",
			fileId: "file-1",
		});

		expect(fileProcessingQueue.add).toHaveBeenCalledWith(
			"process-uploaded-file",
			{
				userId: "user-1",
				fileId: "file-1",
			},
			{
				jobId: "process-uploaded-file:user-1:file-1",
			}
		);
	});
});
