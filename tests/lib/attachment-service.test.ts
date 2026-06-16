import { buildVisionContentParts } from "@/lib/attachments/attachment-service";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
	getPresignedStoredFileUrl: vi.fn(),
	readStoredFileObject: vi.fn(),
}));

vi.mock("@/lib/rag/storage", () => ({
	getPresignedStoredFileUrl: storageMocks.getPresignedStoredFileUrl,
	readStoredFileObject: storageMocks.readStoredFileObject,
}));

const ENV_KEYS = [
	"VISION_IMAGE_DELIVERY_MODE",
	"VISION_IMAGE_PRESIGNED_URL_TTL_SECONDS",
];

function resetEnv() {
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
}

describe("attachment service", () => {
	beforeEach(() => {
		resetEnv();
		storageMocks.getPresignedStoredFileUrl.mockReset();
		storageMocks.readStoredFileObject.mockReset();
	});

	it("uses short-lived presigned R2 URLs for vision images in auto mode", async () => {
		storageMocks.getPresignedStoredFileUrl.mockResolvedValue(
			"https://signed.example/image.png"
		);

		await expect(
			buildVisionContentParts([
				{
					fileObjectId: "file-image-1",
					kind: "image",
					promptUse: "vision",
					displayOrder: 0,
					filename: "image.png",
					mimeType: "image/png",
					sizeBytes: 8,
					storageProvider: "r2",
					storageKey: "user-1/file-image-1.png",
				},
			])
		).resolves.toEqual([
			{
				type: "image_url",
				imageUrl: "https://signed.example/image.png",
			},
		]);
		expect(storageMocks.getPresignedStoredFileUrl).toHaveBeenCalledWith(
			{
				storageProvider: "r2",
				storageKey: "user-1/file-image-1.png",
			},
			300
		);
		expect(storageMocks.readStoredFileObject).not.toHaveBeenCalled();
	});

	it("keeps local vision images private through server-side base64", async () => {
		storageMocks.readStoredFileObject.mockResolvedValue(
			Buffer.from("image-bytes")
		);

		await expect(
			buildVisionContentParts([
				{
					fileObjectId: "file-image-1",
					kind: "image",
					promptUse: "vision",
					displayOrder: 0,
					filename: "image.png",
					mimeType: "image/png",
					sizeBytes: 8,
					storageProvider: "local",
					storageKey: "user-1/file-image-1.png",
				},
			])
		).resolves.toEqual([
			{
				type: "image_url",
				imageUrl: `data:image/png;base64,${Buffer.from("image-bytes").toString("base64")}`,
			},
		]);
		expect(storageMocks.getPresignedStoredFileUrl).not.toHaveBeenCalled();
	});
});
