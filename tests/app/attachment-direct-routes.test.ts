import { POST as abortDirectUpload } from "@/app/api/attachments/direct/abort/route";
import { POST as completeDirectUpload } from "@/app/api/attachments/direct/complete/route";
import { POST as initiateDirectUpload } from "@/app/api/attachments/direct/initiate/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));
const prismaMocks = vi.hoisted(() => ({
	fileCreate: vi.fn(),
	fileFindFirst: vi.fn(),
	fileUpdate: vi.fn(),
	fileDelete: vi.fn(),
}));
const queueMocks = vi.hoisted(() => ({
	enqueueUploadedFileProcessingJob: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
	abortR2MultipartUpload: vi.fn(),
	buildStoredFileKey: vi.fn(),
	completeR2MultipartUpload: vi.fn(),
	createR2MultipartUpload: vi.fn(),
	deleteStoredFileObject: vi.fn(),
	isR2DirectUploadAvailable: vi.fn(),
	readStoredFileObject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
		},
	},
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		fileObject: {
			create: prismaMocks.fileCreate,
			findFirst: prismaMocks.fileFindFirst,
			update: prismaMocks.fileUpdate,
			delete: prismaMocks.fileDelete,
		},
	},
}));

vi.mock("@/lib/queue/file-processing", () => ({
	enqueueUploadedFileProcessingJob:
		queueMocks.enqueueUploadedFileProcessingJob,
}));

vi.mock("@/lib/rag/storage", () => ({
	abortR2MultipartUpload: storageMocks.abortR2MultipartUpload,
	buildStoredFileKey: storageMocks.buildStoredFileKey,
	completeR2MultipartUpload: storageMocks.completeR2MultipartUpload,
	createR2MultipartUpload: storageMocks.createR2MultipartUpload,
	deleteStoredFileObject: storageMocks.deleteStoredFileObject,
	isR2DirectUploadAvailable: storageMocks.isR2DirectUploadAvailable,
	readStoredFileObject: storageMocks.readStoredFileObject,
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
}));

function jsonRequest(path: string, body: unknown) {
	return new Request(`http://localhost${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function pngBytes() {
	return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

describe("direct attachment upload routes", () => {
	beforeEach(() => {
		authMocks.getSession.mockReset();
		prismaMocks.fileCreate.mockReset();
		prismaMocks.fileFindFirst.mockReset();
		prismaMocks.fileUpdate.mockReset();
		prismaMocks.fileDelete.mockReset();
		queueMocks.enqueueUploadedFileProcessingJob.mockReset();
		storageMocks.abortR2MultipartUpload.mockReset();
		storageMocks.buildStoredFileKey.mockReset();
		storageMocks.completeR2MultipartUpload.mockReset();
		storageMocks.createR2MultipartUpload.mockReset();
		storageMocks.deleteStoredFileObject.mockReset();
		storageMocks.isR2DirectUploadAvailable.mockReset();
		storageMocks.readStoredFileObject.mockReset();

		authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		storageMocks.isR2DirectUploadAvailable.mockReturnValue(true);
		storageMocks.buildStoredFileKey.mockReturnValue(
			"user-1/file-direct-1.pdf"
		);
		storageMocks.createR2MultipartUpload.mockResolvedValue({
			uploadId: "upload-1",
			partSizeBytes: 5 * 1024 * 1024,
			expiresInSeconds: 900,
			parts: [
				{
					partNumber: 1,
					startByte: 0,
					endByte: 1024,
					url: "https://r2.example/part-1",
				},
			],
		});
		storageMocks.completeR2MultipartUpload.mockResolvedValue(undefined);
		storageMocks.deleteStoredFileObject.mockResolvedValue(undefined);
		storageMocks.abortR2MultipartUpload.mockResolvedValue(undefined);
		prismaMocks.fileDelete.mockResolvedValue({ id: "file-direct-1" });
	});

	it("initiates R2 multipart uploads with an uploading file row", async () => {
		prismaMocks.fileCreate.mockResolvedValue({
			id: "file-direct-1",
			filename: "brief.pdf",
			mimeType: "application/pdf",
			kind: "pdf",
			purpose: "rag_document",
			sizeBytes: 1024,
			status: "uploading",
			chunkCount: 0,
			errorCode: null,
			createdAt: new Date("2026-06-07T00:00:00.000Z"),
		});

		const response = await initiateDirectUpload(
			jsonRequest("/api/attachments/direct/initiate", {
				filename: "brief.pdf",
				mimeType: "application/pdf",
				sizeBytes: 1024,
			})
		);

		expect(response.status).toBe(201);
		expect(prismaMocks.fileCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					userId: "user-1",
					storageProvider: "r2",
					kind: "pdf",
					purpose: "rag_document",
					status: "uploading",
				}),
			})
		);
		expect(storageMocks.createR2MultipartUpload).toHaveBeenCalledWith({
			storageKey: "user-1/file-direct-1.pdf",
			mimeType: "application/pdf",
			sizeBytes: 1024,
		});
		await expect(response.json()).resolves.toMatchObject({
			attachment: {
				fileObjectId: "file-direct-1",
				status: "uploading",
			},
			upload: {
				fileObjectId: "file-direct-1",
				uploadId: "upload-1",
				storageProvider: "r2",
			},
		});
	});

	it("falls back cleanly when R2 direct upload is unavailable", async () => {
		storageMocks.isR2DirectUploadAvailable.mockReturnValue(false);

		const response = await initiateDirectUpload(
			jsonRequest("/api/attachments/direct/initiate", {
				filename: "brief.pdf",
				mimeType: "application/pdf",
				sizeBytes: 1024,
			})
		);

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			errorCode: "DIRECT_UPLOAD_UNSUPPORTED",
		});
		expect(prismaMocks.fileCreate).not.toHaveBeenCalled();
	});

	it("completes image uploads after server-side byte validation", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-image-1",
			filename: "chart.png",
			mimeType: "image/png",
			extension: ".png",
			kind: "image",
			purpose: "vision_image",
			sizeBytes: pngBytes().byteLength,
			status: "uploading",
			storageProvider: "r2",
			storageKey: "user-1/file-image-1.png",
		});
		storageMocks.readStoredFileObject.mockResolvedValue(pngBytes());
		prismaMocks.fileUpdate.mockResolvedValue({
			id: "file-image-1",
			filename: "chart.png",
			mimeType: "image/png",
			kind: "image",
			purpose: "vision_image",
			sizeBytes: pngBytes().byteLength,
			status: "ready",
			chunkCount: 0,
			errorCode: null,
			createdAt: new Date("2026-06-07T00:00:00.000Z"),
			updatedAt: new Date("2026-06-07T00:00:00.000Z"),
			processedAt: new Date("2026-06-07T00:00:00.000Z"),
		});

		const response = await completeDirectUpload(
			jsonRequest("/api/attachments/direct/complete", {
				fileObjectId: "file-image-1",
				uploadId: "upload-1",
				parts: [{ partNumber: 1, etag: '"etag-1"' }],
			})
		);

		expect(response.status).toBe(201);
		expect(storageMocks.completeR2MultipartUpload).toHaveBeenCalledWith({
			reference: {
				storageProvider: "r2",
				storageKey: "user-1/file-image-1.png",
			},
			uploadId: "upload-1",
			parts: [{ partNumber: 1, etag: '"etag-1"' }],
		});
		expect(
			queueMocks.enqueueUploadedFileProcessingJob
		).not.toHaveBeenCalled();
		expect(prismaMocks.fileUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "ready",
					checksumSha256: expect.any(String),
				}),
			})
		);
		await expect(response.json()).resolves.toMatchObject({
			status: "ready",
			jobId: null,
			attachment: {
				fileObjectId: "file-image-1",
				kind: "image",
				status: "ready",
			},
		});
	});

	it("marks completed direct uploads failed and deletes invalid objects", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-image-1",
			filename: "chart.png",
			mimeType: "image/png",
			extension: ".png",
			kind: "image",
			purpose: "vision_image",
			sizeBytes: 99,
			status: "uploading",
			storageProvider: "r2",
			storageKey: "user-1/file-image-1.png",
		});
		storageMocks.readStoredFileObject.mockResolvedValue(pngBytes());
		prismaMocks.fileUpdate.mockResolvedValue({ id: "file-image-1" });

		const response = await completeDirectUpload(
			jsonRequest("/api/attachments/direct/complete", {
				fileObjectId: "file-image-1",
				uploadId: "upload-1",
				parts: [{ partNumber: 1, etag: '"etag-1"' }],
			})
		);

		expect(response.status).toBe(400);
		expect(storageMocks.deleteStoredFileObject).toHaveBeenCalledWith({
			storageProvider: "r2",
			storageKey: "user-1/file-image-1.png",
		});
		expect(prismaMocks.fileUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "failed",
					errorCode: "DIRECT_UPLOAD_SIZE_MISMATCH",
				}),
			})
		);
	});

	it("aborts pending R2 multipart uploads", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-direct-1",
			storageProvider: "r2",
			storageKey: "user-1/file-direct-1.pdf",
			status: "uploading",
		});

		const response = await abortDirectUpload(
			jsonRequest("/api/attachments/direct/abort", {
				fileObjectId: "file-direct-1",
				uploadId: "upload-1",
			})
		);

		expect(response.status).toBe(200);
		expect(storageMocks.abortR2MultipartUpload).toHaveBeenCalledWith({
			reference: {
				storageProvider: "r2",
				storageKey: "user-1/file-direct-1.pdf",
			},
			uploadId: "upload-1",
		});
		expect(prismaMocks.fileDelete).toHaveBeenCalledWith({
			where: { id: "file-direct-1" },
		});
	});
});
