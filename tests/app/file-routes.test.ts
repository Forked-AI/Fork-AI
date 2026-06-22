import { DELETE, GET } from "@/app/api/files/[id]/route";
import { GET as listFiles, POST as uploadFile } from "@/app/api/files/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));
const idempotencyMocks = vi.hoisted(() => ({
	beginIdempotency: vi.fn(),
	withJsonIdempotency: vi.fn(),
}));
const prismaMocks = vi.hoisted(() => ({
	fileCreate: vi.fn(),
	fileFindMany: vi.fn(),
	fileFindFirst: vi.fn(),
	fileDelete: vi.fn(),
	moderationEventCreate: vi.fn(),
	abuseSignalCreate: vi.fn(),
}));
const queueMocks = vi.hoisted(() => ({
	enqueueUploadedFileProcessingJob: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
	buildStoredFileKey: vi.fn(),
	saveFileObject: vi.fn(),
	deleteStoredFileObject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
		},
	},
}));

vi.mock("@/lib/idempotency", () => ({
	beginIdempotency: idempotencyMocks.beginIdempotency,
	getUserIdempotencyActorKey: vi.fn((userId: string) => `user:${userId}`),
	withJsonIdempotency: idempotencyMocks.withJsonIdempotency,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		fileObject: {
			create: prismaMocks.fileCreate,
			findMany: prismaMocks.fileFindMany,
			findFirst: prismaMocks.fileFindFirst,
			delete: prismaMocks.fileDelete,
		},
		moderationEvent: {
			create: prismaMocks.moderationEventCreate,
		},
		abuseSignal: {
			create: prismaMocks.abuseSignalCreate,
		},
	},
}));

vi.mock("@/lib/queue/file-processing", () => ({
	enqueueUploadedFileProcessingJob:
		queueMocks.enqueueUploadedFileProcessingJob,
}));

vi.mock("@/lib/rag/storage", () => ({
	buildStoredFileKey: storageMocks.buildStoredFileKey,
	saveFileObject: storageMocks.saveFileObject,
	deleteStoredFileObject: storageMocks.deleteStoredFileObject,
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
	logServerWarning: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
}));

function createUploadRequest(file: Blob, filename: string) {
	const formData = new FormData();
	formData.append("file", file, filename);
	formData.append("filename", filename);
	return new Request("http://localhost/api/files", {
		method: "POST",
		headers: {
			"Idempotency-Key": "file-upload-key",
		},
		body: formData,
	});
}

describe("file routes", () => {
	beforeEach(() => {
		authMocks.getSession.mockReset();
		idempotencyMocks.beginIdempotency.mockReset();
		idempotencyMocks.withJsonIdempotency.mockReset();
		prismaMocks.fileCreate.mockReset();
		prismaMocks.fileFindMany.mockReset();
		prismaMocks.fileFindFirst.mockReset();
		prismaMocks.fileDelete.mockReset();
		prismaMocks.moderationEventCreate.mockReset();
		prismaMocks.abuseSignalCreate.mockReset();
		queueMocks.enqueueUploadedFileProcessingJob.mockReset();
		storageMocks.buildStoredFileKey.mockReset();
		storageMocks.saveFileObject.mockReset();
		storageMocks.deleteStoredFileObject.mockReset();

		authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		idempotencyMocks.beginIdempotency.mockResolvedValue({
			started: true,
			record: {
				id: "idem-1",
				key: "file-upload-key",
				complete: vi.fn(),
				fail: vi.fn(),
			},
		});
		idempotencyMocks.withJsonIdempotency.mockImplementation(
			async (_request, _options, handler) => {
				const result = await handler();
				return Response.json(result.body, {
					status: result.status ?? 200,
				});
			}
		);
		storageMocks.buildStoredFileKey.mockReturnValue("user-1/file-1.md");
		storageMocks.saveFileObject.mockResolvedValue({
			storageProvider: "local",
			storageKey: "user-1/file-1.md",
			checksumSha256: "sha256",
		});
		storageMocks.deleteStoredFileObject.mockResolvedValue(undefined);
		prismaMocks.moderationEventCreate.mockResolvedValue({
			id: "moderation-1",
		});
		prismaMocks.abuseSignalCreate.mockResolvedValue({
			id: "abuse-signal-1",
		});
		queueMocks.enqueueUploadedFileProcessingJob.mockResolvedValue({
			id: "process-job-1",
		});
	});

	it("lists only files owned by the authenticated user", async () => {
		prismaMocks.fileFindMany.mockResolvedValue([
			{
				id: "file-1",
				filename: "notes.md",
				status: "ready",
				chunkCount: 2,
			},
		]);

		const response = await listFiles(
			new Request("http://localhost/api/files?status=ready")
		);

		expect(response.status).toBe(200);
		expect(prismaMocks.fileFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					userId: "user-1",
					organizationId: null,
					purpose: "rag_document",
					status: "ready",
				},
			})
		);
		await expect(response.json()).resolves.toEqual({
			files: [
				{
					id: "file-1",
					filename: "notes.md",
					status: "ready",
					chunkCount: 2,
				},
			],
		});
	});

	it("validates extension and MIME before storing an upload", async () => {
		const response = await uploadFile(
			createUploadRequest(
				new Blob(["hello"], {
					type: "text/plain",
				}),
				"malware.exe"
			)
		);

		expect(response.status).toBe(400);
		expect(storageMocks.saveFileObject).not.toHaveBeenCalled();
		expect(prismaMocks.fileCreate).not.toHaveBeenCalled();
	});

	it("blocks scanner-detected malware signatures before storage", async () => {
		const response = await uploadFile(
			createUploadRequest(
				new Blob(
					[
						"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
					],
					{
						type: "text/plain",
					}
				),
				"EICAR-STANDARD-ANTIVIRUS-TEST-FILE.txt"
			)
		);

		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toMatchObject({
			errorCode: "MODERATION_BLOCKED",
			moderation: {
				category: "malware",
				action: "block",
				severity: "critical",
			},
		});
		expect(storageMocks.saveFileObject).not.toHaveBeenCalled();
		expect(prismaMocks.fileCreate).not.toHaveBeenCalled();
		expect(prismaMocks.moderationEventCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				source: "file_upload",
				stage: "file_upload",
				category: "malware",
				action: "block",
				contentHash: expect.any(String),
			}),
		});
		expect(prismaMocks.abuseSignalCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				signalType: "file_scanner_block",
				action: "block",
			}),
		});
	});

	it("stores valid uploads and enqueues asynchronous processing", async () => {
		prismaMocks.fileCreate.mockResolvedValue({
			id: "file-1",
			filename: "notes.md",
			mimeType: "text/markdown",
			sizeBytes: 11,
			status: "uploaded",
			chunkCount: 0,
			createdAt: new Date("2026-06-06T00:00:00.000Z"),
		});

		const response = await uploadFile(
			createUploadRequest(
				new Blob(["hello world"], {
					type: "text/markdown",
				}),
				"notes.md"
			)
		);

		expect(response.status).toBe(202);
		expect(prismaMocks.fileCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					userId: "user-1",
					filename: "notes.md",
					status: "uploaded",
				}),
			})
		);
		expect(
			queueMocks.enqueueUploadedFileProcessingJob
		).toHaveBeenCalledWith({
			fileId: "file-1",
			userId: "user-1",
		});
		await expect(response.json()).resolves.toMatchObject({
			status: "queued",
			jobId: "process-job-1",
			file: {
				id: "file-1",
			},
		});
	});

	it("cleans up an R2 upload when persistence fails after storage succeeds", async () => {
		storageMocks.buildStoredFileKey.mockReturnValue(
			"prod/user-1/file-1.md"
		);
		storageMocks.saveFileObject.mockResolvedValue({
			storageProvider: "r2",
			storageKey: "prod/user-1/file-1.md",
			checksumSha256: "sha256",
		});
		prismaMocks.fileCreate.mockRejectedValue(new Error("db unavailable"));

		const response = await uploadFile(
			createUploadRequest(
				new Blob(["hello world"], {
					type: "text/markdown",
				}),
				"notes.md"
			)
		);

		expect(response.status).toBe(500);
		expect(storageMocks.deleteStoredFileObject).toHaveBeenCalledWith({
			storageProvider: "r2",
			storageKey: "prod/user-1/file-1.md",
		});
	});

	it("returns 404 for file detail when the user does not own the file", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost/api/files/file-2"),
			{
				params: Promise.resolve({ id: "file-2" }),
			}
		);

		expect(response.status).toBe(404);
		expect(prismaMocks.fileFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "file-2",
					userId: "user-1",
					organizationId: null,
					purpose: "rag_document",
				},
			})
		);
	});

	it("deletes storage and database rows only after ownership is proven", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-1",
			storageProvider: "local",
			storageKey: "user-1/file-1.md",
		});
		prismaMocks.fileDelete.mockResolvedValue({ id: "file-1" });

		const response = await DELETE(
			new Request("http://localhost/api/files/file-1", {
				method: "DELETE",
				headers: { "Idempotency-Key": "delete-file" },
			}),
			{
				params: Promise.resolve({ id: "file-1" }),
			}
		);

		expect(response.status).toBe(200);
		expect(storageMocks.deleteStoredFileObject).toHaveBeenCalledWith({
			id: "file-1",
			storageProvider: "local",
			storageKey: "user-1/file-1.md",
		});
		expect(prismaMocks.fileDelete).toHaveBeenCalledWith({
			where: { id: "file-1" },
		});
	});
});
