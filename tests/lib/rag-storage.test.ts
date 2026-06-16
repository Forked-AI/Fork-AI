import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const s3Mocks = vi.hoisted(() => ({
	clientConfigs: [] as unknown[],
	send: vi.fn(),
	getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
	class MockCommand {
		input: unknown;

		constructor(input: unknown) {
			this.input = input;
		}
	}

	class S3Client {
		send = s3Mocks.send;

		constructor(config: unknown) {
			s3Mocks.clientConfigs.push(config);
		}
	}

	return {
		S3Client,
		PutObjectCommand: MockCommand,
		GetObjectCommand: MockCommand,
		DeleteObjectCommand: MockCommand,
		CreateMultipartUploadCommand: MockCommand,
		UploadPartCommand: MockCommand,
		CompleteMultipartUploadCommand: MockCommand,
		AbortMultipartUploadCommand: MockCommand,
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: s3Mocks.getSignedUrl,
}));

const STORAGE_ENV_KEYS = [
	"FILE_STORAGE_PROVIDER",
	"FILE_STORAGE_ROOT",
	"R2_ACCOUNT_ID",
	"R2_ENDPOINT",
	"R2_BUCKET_NAME",
	"R2_ACCESS_KEY_ID",
	"R2_SECRET_ACCESS_KEY",
	"R2_KEY_PREFIX",
	"DIRECT_UPLOAD_PART_BYTES",
	"DIRECT_UPLOAD_URL_TTL_SECONDS",
	"VISION_IMAGE_PRESIGNED_URL_TTL_SECONDS",
];

function resetStorageEnv() {
	for (const key of STORAGE_ENV_KEYS) {
		delete process.env[key];
	}
}

describe("file object storage", () => {
	beforeEach(() => {
		vi.resetModules();
		resetStorageEnv();
		s3Mocks.clientConfigs.length = 0;
		s3Mocks.send.mockReset();
		s3Mocks.getSignedUrl.mockReset();
	});

	it("defaults to local storage keys without requiring R2 config", async () => {
		const { buildStoredFileKey, getConfiguredFileStorageProvider } =
			await import("@/lib/rag/storage");

		expect(getConfiguredFileStorageProvider()).toBe("local");
		expect(
			buildStoredFileKey({
				userId: "user:1",
				fileId: "file/1",
				extension: ".md",
			})
		).toBe("user_1/file_1.md");
	});

	it("rejects unsupported configured providers", async () => {
		process.env.FILE_STORAGE_PROVIDER = "s3";
		const { getConfiguredFileStorageProvider } =
			await import("@/lib/rag/storage");

		expect(() => getConfiguredFileStorageProvider()).toThrow(
			"Unsupported FILE_STORAGE_PROVIDER"
		);
	});

	it("rejects unsupported stored object providers", async () => {
		const { readStoredFileObject } = await import("@/lib/rag/storage");

		await expect(
			readStoredFileObject({
				storageProvider: "s3",
				storageKey: "user-1/file-1.md",
			})
		).rejects.toThrow("Unsupported storage provider");
	});

	it("writes R2 objects with stable keys and SHA-256 checksums", async () => {
		process.env.FILE_STORAGE_PROVIDER = "r2";
		process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
		process.env.R2_BUCKET_NAME = "fork-ai-files";
		process.env.R2_ACCESS_KEY_ID = "access-key";
		process.env.R2_SECRET_ACCESS_KEY = "secret-key";
		process.env.R2_KEY_PREFIX = "prod/uploads/";
		s3Mocks.send.mockResolvedValue({});
		const { buildStoredFileKey, saveFileObject } =
			await import("@/lib/rag/storage");

		const storageKey = buildStoredFileKey({
			userId: "user:1",
			fileId: "file/1",
			extension: ".md",
		});
		const buffer = Buffer.from("hello world");
		const stored = await saveFileObject({ storageKey, buffer });

		expect(storageKey).toBe("prod/uploads/user_1/file_1.md");
		expect(stored).toEqual({
			storageProvider: "r2",
			storageKey,
			checksumSha256: createHash("sha256").update(buffer).digest("hex"),
		});
		expect(s3Mocks.clientConfigs).toEqual([
			expect.objectContaining({
				region: "auto",
				endpoint: "https://example.r2.cloudflarestorage.com",
				forcePathStyle: true,
			}),
		]);
		expect(s3Mocks.send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: {
					Bucket: "fork-ai-files",
					Key: storageKey,
					Body: buffer,
					ContentLength: buffer.byteLength,
				},
			})
		);
	});

	it("reads and deletes R2 objects through the S3-compatible client", async () => {
		process.env.FILE_STORAGE_PROVIDER = "r2";
		process.env.R2_ACCOUNT_ID = "account-id";
		process.env.R2_BUCKET_NAME = "fork-ai-files";
		process.env.R2_ACCESS_KEY_ID = "access-key";
		process.env.R2_SECRET_ACCESS_KEY = "secret-key";
		s3Mocks.send
			.mockResolvedValueOnce({
				Body: {
					transformToByteArray: async () =>
						new Uint8Array(Buffer.from("stored text")),
				},
			})
			.mockResolvedValueOnce({});
		const { deleteStoredFileObject, readStoredFileObject } =
			await import("@/lib/rag/storage");

		await expect(
			readStoredFileObject({
				storageProvider: "r2",
				storageKey: "user-1/file-1.md",
			})
		).resolves.toEqual(Buffer.from("stored text"));
		await deleteStoredFileObject({
			storageProvider: "r2",
			storageKey: "user-1/file-1.md",
		});

		expect(s3Mocks.clientConfigs[0]).toEqual(
			expect.objectContaining({
				endpoint: "https://account-id.r2.cloudflarestorage.com",
			})
		);
		expect(s3Mocks.send).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				input: {
					Bucket: "fork-ai-files",
					Key: "user-1/file-1.md",
				},
			})
		);
		expect(s3Mocks.send).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				input: {
					Bucket: "fork-ai-files",
					Key: "user-1/file-1.md",
				},
			})
		);
	});

	it("creates presigned R2 multipart upload URLs and completes uploads", async () => {
		process.env.FILE_STORAGE_PROVIDER = "r2";
		process.env.R2_ACCOUNT_ID = "account-id";
		process.env.R2_BUCKET_NAME = "fork-ai-files";
		process.env.R2_ACCESS_KEY_ID = "access-key";
		process.env.R2_SECRET_ACCESS_KEY = "secret-key";
		process.env.DIRECT_UPLOAD_PART_BYTES = String(5 * 1024 * 1024);
		s3Mocks.send.mockResolvedValueOnce({ UploadId: "upload-1" });
		s3Mocks.getSignedUrl
			.mockResolvedValueOnce("https://signed.example/part-1")
			.mockResolvedValueOnce("https://signed.example/part-2");

		const {
			createR2MultipartUpload,
			completeR2MultipartUpload,
			abortR2MultipartUpload,
			getPresignedStoredFileUrl,
		} = await import("@/lib/rag/storage");

		const upload = await createR2MultipartUpload({
			storageKey: "user-1/file-1.pdf",
			mimeType: "application/pdf",
			sizeBytes: 6 * 1024 * 1024,
		});

		expect(upload).toMatchObject({
			uploadId: "upload-1",
			partSizeBytes: 5 * 1024 * 1024,
			parts: [
				{
					partNumber: 1,
					startByte: 0,
					endByte: 5 * 1024 * 1024,
					url: "https://signed.example/part-1",
				},
				{
					partNumber: 2,
					startByte: 5 * 1024 * 1024,
					endByte: 6 * 1024 * 1024,
					url: "https://signed.example/part-2",
				},
			],
		});
		expect(s3Mocks.getSignedUrl).toHaveBeenCalledTimes(2);

		s3Mocks.send.mockResolvedValueOnce({});
		await completeR2MultipartUpload({
			reference: {
				storageProvider: "r2",
				storageKey: "user-1/file-1.pdf",
			},
			uploadId: "upload-1",
			parts: [
				{ partNumber: 2, etag: '"etag-2"' },
				{ partNumber: 1, etag: '"etag-1"' },
			],
		});
		expect(s3Mocks.send).toHaveBeenLastCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({
					UploadId: "upload-1",
					MultipartUpload: {
						Parts: [
							{ PartNumber: 1, ETag: '"etag-1"' },
							{ PartNumber: 2, ETag: '"etag-2"' },
						],
					},
				}),
			})
		);

		s3Mocks.send.mockResolvedValueOnce({});
		await abortR2MultipartUpload({
			reference: {
				storageProvider: "r2",
				storageKey: "user-1/file-1.pdf",
			},
			uploadId: "upload-1",
		});

		s3Mocks.getSignedUrl.mockResolvedValueOnce(
			"https://signed.example/read"
		);
		await expect(
			getPresignedStoredFileUrl({
				storageProvider: "r2",
				storageKey: "user-1/file-1.pdf",
			})
		).resolves.toBe("https://signed.example/read");
	});
});
