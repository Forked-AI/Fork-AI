import type { DocumentFileContentKind } from "@/lib/rag/file-validation";
import {
	getConfiguredPdfOcrProvider,
	PdfOcrError,
	type PdfOcrProvider,
} from "@/lib/rag/ocr-provider";
import { parsePdfText, PdfParseError } from "@/lib/rag/pdf-parser";

export interface ExtractTextInput {
	buffer: Buffer;
	filename: string;
	kind: DocumentFileContentKind;
}

export interface ExtractedText {
	text: string;
	pageCount?: number;
}

export interface ExtractTextOptions {
	pdfOcrProvider?: PdfOcrProvider | null;
}

export class TextExtractionError extends Error {
	public readonly errorCode: string;

	constructor(message: string, errorCode: string) {
		super(message);
		this.name = "TextExtractionError";
		this.errorCode = errorCode;
	}
}

function normalizeExtractedText(text: string) {
	return text
		.replace(/\u0000/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{4,}/g, "\n\n\n")
		.trim();
}

function decodeText(buffer: Buffer) {
	const decoded = buffer.toString("utf8");
	const text = normalizeExtractedText(decoded);

	if (!text) {
		throw new TextExtractionError(
			"No extractable text was found.",
			"FILE_TEXT_EMPTY"
		);
	}

	return { text };
}

async function extractPdfTextWithFallbackOcr(
	input: ExtractTextInput,
	options: ExtractTextOptions
): Promise<ExtractedText> {
	try {
		return parsePdfText(input.buffer);
	} catch (error) {
		if (!(error instanceof PdfParseError)) {
			throw error;
		}

		if (error.errorCode !== "PDF_SCANNED_TEXT_UNAVAILABLE") {
			throw new TextExtractionError(error.message, error.errorCode);
		}

		const ocrProvider =
			options.pdfOcrProvider === undefined
				? getConfiguredPdfOcrProvider()
				: options.pdfOcrProvider;
		if (!ocrProvider) {
			throw new TextExtractionError(error.message, error.errorCode);
		}

		try {
			return await ocrProvider.extractPdfText({
				buffer: input.buffer,
				filename: input.filename,
				mimeType: "application/pdf",
			});
		} catch (ocrError) {
			if (ocrError instanceof PdfOcrError) {
				throw new TextExtractionError(
					ocrError.message,
					ocrError.errorCode
				);
			}

			throw new TextExtractionError("PDF OCR failed.", "PDF_OCR_FAILED");
		}
	}
}

export async function extractTextFromFile(
	input: ExtractTextInput,
	options: ExtractTextOptions = {}
): Promise<ExtractedText> {
	if (input.kind === "pdf") {
		return extractPdfTextWithFallbackOcr(input, options);
	}

	return decodeText(input.buffer);
}
