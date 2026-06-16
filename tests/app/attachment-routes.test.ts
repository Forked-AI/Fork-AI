import { GET as getAttachment, DELETE } from "@/app/api/attachments/[id]/route";
import { GET as getAttachmentContent } from "@/app/api/attachments/[id]/content/route";
import { POST as uploadAttachment } from "@/app/api/attachments/route";
import { FileValidationError } from "@/lib/rag/file-validation";
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
	fileFindFirst: vi.fn(),
	fileDelete: vi.fn(),
}));
const queueMocks = vi.hoisted(() => ({
	enqueueUploadedFileProcessingJob: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
	buildStoredFileKey: vi.fn(),
	saveFileObject: vi.fn(),
	readStoredFileObject: vi.fn(),
	deleteStoredFileObject: vi.fn(),
}));
const validationMocks = vi.hoisted(() => ({
	validateUploadFile: vi.fn(),
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
			findFirst: prismaMocks.fileFindFirst,
			delete: prismaMocks.fileDelete,
		},
	},
}));

vi.mock("@/lib/rag/file-validation", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/rag/file-validation")>();
	return {
		...actual,
		validateUploadFile: validationMocks.validateUploadFile,
	};
});

vi.mock("@/lib/queue/file-processing", () => ({
	enqueueUploadedFileProcessingJob:
		queueMocks.enqueueUploadedFileProcessingJob,
}));

vi.mock("@/lib/rag/storage", () => ({
	buildStoredFileKey: storageMocks.buildStoredFileKey,
	saveFileObject: storageMocks.saveFileObject,
	readStoredFileObject: storageMocks.readStoredFileObject,
	deleteStoredFileObject: storageMocks.deleteStoredFileObject,
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
}));

function createUploadRequest(file: Blob, filename: string) {
	const formData = new FormData();
	if (file instanceof File) {
		formData.append("file", file);
	} else {
		formData.append("file", file, filename);
	}
	formData.append("filename", filename);
	return new Request("http://localhost/api/attachments", {
		method: "POST",
		headers: {
			"Idempotency-Key": "attachment-upload-key",
		},
		body: formData,
	});
}

describe("attachment routes", () => {
	beforeEach(() => {
		authMocks.getSession.mockReset();
		idempotencyMocks.beginIdempotency.mockReset();
		idempotencyMocks.withJsonIdempotency.mockReset();
		prismaMocks.fileCreate.mockReset();
		prismaMocks.fileFindFirst.mockReset();
		prismaMocks.fileDelete.mockReset();
		queueMocks.enqueueUploadedFileProcessingJob.mockReset();
		storageMocks.buildStoredFileKey.mockReset();
		storageMocks.saveFileObject.mockReset();
		storageMocks.readStoredFileObject.mockReset();
		storageMocks.deleteStoredFileObject.mockReset();
		validationMocks.validateUploadFile.mockReset();

		authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		idempotencyMocks.beginIdempotency.mockResolvedValue({
			started: true,
			record: {
				id: "idem-1",
				key: "attachment-upload-key",
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
		storageMocks.buildStoredFileKey.mockReturnValue(
			"user-1/file-image-1.png"
		);
		storageMocks.saveFileObject.mockResolvedValue({
			storageProvider: "local",
			storageKey: "user-1/file-image-1.png",
			checksumSha256: "sha256",
		});
		storageMocks.readStoredFileObject.mockResolvedValue(
			Buffer.from("image-bytes")
		);
		storageMocks.deleteStoredFileObject.mockResolvedValue(undefined);
		validationMocks.validateUploadFile.mockReturnValue({
			filename: "chart.webp",
			extension: ".webp",
			mimeType: "image/webp",
			sizeBytes: 12,
			kind: "image",
			purpose: "vision_image",
		});
	});

	it("uploads WebP images as ready vision attachments without queueing parsing", async () => {
		prismaMocks.fileCreate.mockResolvedValue({
			id: "file-image-1",
			filename: "chart.webp",
			mimeType: "image/webp",
			kind: "image",
			purpose: "vision_image",
			sizeBytes: 12,
			status: "ready",
			chunkCount: 0,
			errorCode: null,
			createdAt: new Date("2026-06-06T00:00:00.000Z"),
		});

		const response = await uploadAttachment(
			createUploadRequest(
				new Blob(["image-bytes"], { type: "image/webp" }),
				"chart.webp"
			)
		);

		expect(response.status).toBe(201);
		expect(validationMocks.validateUploadFile).toHaveBeenCalledWith(
			expect.anything(),
			"chart.webp",
			expect.objectContaining({
				allowImages: true,
				buffer: expect.anything(),
			})
		);
		expect(
			queueMocks.enqueueUploadedFileProcessingJob
		).not.toHaveBeenCalled();
		expect(prismaMocks.fileCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					userId: "user-1",
					kind: "image",
					purpose: "vision_image",
					status: "ready",
					processedAt: expect.any(Date),
				}),
			})
		);
		await expect(response.json()).resolves.toMatchObject({
			status: "ready",
			jobId: null,
			attachment: {
				fileObjectId: "file-image-1",
				kind: "image",
				fileKind: "image",
				purpose: "vision_image",
				status: "ready",
				contentUrl: "/api/attachments/file-image-1/content",
			},
		});
	});

	it("rejects SVG uploads before storage", async () => {
		validationMocks.validateUploadFile.mockImplementationOnce(() => {
			throw new FileValidationError(
				"Unsupported file type.",
				"FILE_TYPE_UNSUPPORTED"
			);
		});

		const response = await uploadAttachment(
			createUploadRequest(
				new Blob(["<svg></svg>"], { type: "image/svg+xml" }),
				"unsafe.svg"
			)
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			errorCode: "FILE_TYPE_UNSUPPORTED",
		});
		expect(storageMocks.saveFileObject).not.toHaveBeenCalled();
		expect(prismaMocks.fileCreate).not.toHaveBeenCalled();
	});

	it("returns owned attachment metadata", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-image-1",
			filename: "chart.png",
			mimeType: "image/png",
			kind: "image",
			purpose: "vision_image",
			sizeBytes: 9,
			status: "ready",
			chunkCount: 0,
			errorCode: null,
			createdAt: new Date("2026-06-06T00:00:00.000Z"),
			updatedAt: new Date("2026-06-06T00:00:00.000Z"),
			processedAt: new Date("2026-06-06T00:00:00.000Z"),
		});

		const response = await getAttachment(
			new Request("http://localhost/api/attachments/file-image-1"),
			{ params: Promise.resolve({ id: "file-image-1" }) }
		);

		expect(response.status).toBe(200);
		expect(prismaMocks.fileFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "file-image-1", userId: "user-1" },
			})
		);
		await expect(response.json()).resolves.toMatchObject({
			attachment: {
				fileObjectId: "file-image-1",
				kind: "image",
				contentUrl: "/api/attachments/file-image-1/content",
			},
		});
	});

	it("streams authenticated image previews from private storage", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-image-1",
			status: "ready",
			mimeType: "image/png",
			sizeBytes: 9,
			storageProvider: "local",
			storageKey: "user-1/file-image-1.png",
		});

		const response = await getAttachmentContent(
			new Request(
				"http://localhost/api/attachments/file-image-1/content"
			),
			{ params: Promise.resolve({ id: "file-image-1" }) }
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(storageMocks.readStoredFileObject).toHaveBeenCalledWith({
			id: "file-image-1",
			status: "ready",
			mimeType: "image/png",
			sizeBytes: 9,
			storageProvider: "local",
			storageKey: "user-1/file-image-1.png",
		});
		expect(await response.text()).toBe("image-bytes");
	});

	it("deletes owned attachments and their stored object", async () => {
		prismaMocks.fileFindFirst.mockResolvedValue({
			id: "file-image-1",
			storageProvider: "local",
			storageKey: "user-1/file-image-1.png",
		});
		prismaMocks.fileDelete.mockResolvedValue({ id: "file-image-1" });

		const response = await DELETE(
			new Request("http://localhost/api/attachments/file-image-1", {
				method: "DELETE",
			}),
			{ params: Promise.resolve({ id: "file-image-1" }) }
		);

		expect(response.status).toBe(200);
		expect(storageMocks.deleteStoredFileObject).toHaveBeenCalledWith({
			id: "file-image-1",
			storageProvider: "local",
			storageKey: "user-1/file-image-1.png",
		});
		expect(prismaMocks.fileDelete).toHaveBeenCalledWith({
			where: { id: "file-image-1" },
		});
		await expect(response.json()).resolves.toEqual({
			success: true,
			status: "deleted",
		});
	});
});
