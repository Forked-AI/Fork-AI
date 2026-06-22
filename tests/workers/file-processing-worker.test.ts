import { describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => ({
	Worker: vi.fn(function Worker(name, processor, options) {
		return {
			name,
			processor,
			options,
			on: vi.fn(),
		};
	}),
	processUploadedFile: vi.fn(),
	reindexFileEmbeddings: vi.fn(),
}));

vi.mock("bullmq", () => ({
	Worker: workerMocks.Worker,
}));

vi.mock("@/lib/queue/connection", () => ({
	queueConnection: { host: "redis.test" },
}));

vi.mock("@/lib/rag/processing-service", () => ({
	processUploadedFile: workerMocks.processUploadedFile,
	reindexFileEmbeddings: workerMocks.reindexFileEmbeddings,
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
}));

describe("file-processing worker", () => {
	it("dispatches uploaded files to the processing service", async () => {
		workerMocks.processUploadedFile.mockResolvedValue({
			fileId: "file-1",
			status: "ready",
			chunkCount: 3,
			parsedTextBytes: 120,
		});

		await import("../../workers/file-processing.worker");
		const processor = workerMocks.Worker.mock.calls[0][1] as (_job: {
			id: string;
			name: string;
			data: { fileId: string; userId: string };
		}) => Promise<void>;

		await processor({
			id: "job-1",
			name: "process-uploaded-file",
			data: {
				fileId: "file-1",
				userId: "user-1",
			},
		});

		expect(workerMocks.processUploadedFile).toHaveBeenCalledWith({
			fileId: "file-1",
			userId: "user-1",
		});
	});

	it("dispatches embedding reindex jobs to the processing service", async () => {
		workerMocks.reindexFileEmbeddings.mockResolvedValue({
			fileId: "file-1",
			status: "ready",
			chunkCount: 3,
		});

		await import("../../workers/file-processing.worker");
		const processor = workerMocks.Worker.mock.calls[0][1] as (_job: {
			id: string;
			name: string;
			data: { fileId: string; userId: string };
		}) => Promise<void>;

		await processor({
			id: "job-1",
			name: "reindex-file-embeddings",
			data: {
				fileId: "file-1",
				userId: "user-1",
			},
		});

		expect(workerMocks.reindexFileEmbeddings).toHaveBeenCalledWith({
			fileId: "file-1",
			userId: "user-1",
		});
	});
});
