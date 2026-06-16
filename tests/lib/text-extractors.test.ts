import {
	extractTextFromFile,
	TextExtractionError,
} from "@/lib/rag/text-extractors";
import { describe, expect, it, vi } from "vitest";

function buildScannedPdf() {
	return Buffer.from(
		[
			"%PDF-1.4",
			"1 0 obj",
			"<< /Type /Page /Resources << /XObject << /Im1 2 0 R >> >> >>",
			"endobj",
			"2 0 obj",
			"<< /Subtype /Image /Filter /DCTDecode /Length 4 >>",
			"stream",
			"xxxx",
			"endstream",
			"endobj",
			"%%EOF",
		].join("\n"),
		"latin1"
	);
}

describe("text extractors", () => {
	it("keeps scanned PDFs failed when OCR is not configured", async () => {
		await expect(
			extractTextFromFile(
				{
					buffer: buildScannedPdf(),
					filename: "scan.pdf",
					kind: "pdf",
				},
				{ pdfOcrProvider: null }
			)
		).rejects.toMatchObject({
			errorCode: "PDF_SCANNED_TEXT_UNAVAILABLE",
		});
	});

	it("falls back to OCR for scanned PDFs", async () => {
		const pdfOcrProvider = {
			extractPdfText: vi.fn().mockResolvedValue({
				text: "OCR markdown text",
				pageCount: 2,
			}),
		};

		await expect(
			extractTextFromFile(
				{
					buffer: buildScannedPdf(),
					filename: "scan.pdf",
					kind: "pdf",
				},
				{ pdfOcrProvider }
			)
		).resolves.toEqual({
			text: "OCR markdown text",
			pageCount: 2,
		});
		expect(pdfOcrProvider.extractPdfText).toHaveBeenCalledWith({
			buffer: buildScannedPdf(),
			filename: "scan.pdf",
			mimeType: "application/pdf",
		});
	});

	it("maps OCR failures to text extraction errors", async () => {
		const pdfOcrProvider = {
			extractPdfText: vi
				.fn()
				.mockRejectedValue(
					new TextExtractionError(
						"OCR unavailable",
						"PDF_OCR_UNAVAILABLE"
					)
				),
		};

		await expect(
			extractTextFromFile(
				{
					buffer: buildScannedPdf(),
					filename: "scan.pdf",
					kind: "pdf",
				},
				{ pdfOcrProvider }
			)
		).rejects.toMatchObject({
			errorCode: "PDF_OCR_FAILED",
		});
	});
});
