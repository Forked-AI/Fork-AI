import {
	FileValidationError,
	validateUploadFile,
} from "@/lib/rag/file-validation";
import { describe, expect, it } from "vitest";

function uploadLike({
	name,
	type,
	size,
}: {
	name: string;
	type: string;
	size: number;
}) {
	return { name, type, size } as Pick<File, "name" | "size" | "type">;
}

describe("file upload validation", () => {
	it("accepts supported images when MIME, extension, and magic bytes match", () => {
		const buffer = Buffer.from("RIFF0000WEBP", "ascii");

		expect(
			validateUploadFile(
				uploadLike({
					name: "chart.webp",
					type: "image/webp",
					size: buffer.length,
				}),
				undefined,
				{
					allowImages: true,
					buffer,
				}
			)
		).toMatchObject({
			filename: "chart.webp",
			extension: ".webp",
			mimeType: "image/webp",
			kind: "image",
			purpose: "vision_image",
		});
	});

	it("rejects SVG uploads as unsupported file types", () => {
		expect(() =>
			validateUploadFile(
				uploadLike({
					name: "unsafe.svg",
					type: "image/svg+xml",
					size: 12,
				}),
				undefined,
				{
					allowImages: true,
					buffer: Buffer.from("<svg></svg>"),
				}
			)
		).toThrow(FileValidationError);
	});

	it("rejects images when magic bytes do not match the extension", () => {
		expect(() =>
			validateUploadFile(
				uploadLike({
					name: "chart.png",
					type: "image/png",
					size: 12,
				}),
				undefined,
				{
					allowImages: true,
					buffer: Buffer.from("RIFF0000WEBP", "ascii"),
				}
			)
		).toThrow("Image MIME type does not match the uploaded content.");
	});
});
