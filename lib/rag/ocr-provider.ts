import { Mistral } from "@mistralai/mistralai";

export interface PdfOcrInput {
	buffer: Buffer;
	filename: string;
	mimeType?: string;
}

export interface PdfOcrResult {
	text: string;
	pageCount?: number;
}

export interface PdfOcrProvider {
	extractPdfText(_input: PdfOcrInput): Promise<PdfOcrResult>;
}

export class PdfOcrError extends Error {
	public readonly errorCode: string;

	constructor(message: string, errorCode: string) {
		super(message);
		this.name = "PdfOcrError";
		this.errorCode = errorCode;
	}
}

const DEFAULT_MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const DEFAULT_PDF_OCR_MAX_BYTES = 10 * 1024 * 1024;

let mistralOcrClient: Mistral | null = null;

function parsePositiveIntegerEnv(name: string, fallback: number) {
	const value = Number(process.env[name]);
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getMistralOcrClient() {
	const apiKey = process.env.MISTRAL_API_KEY?.trim();
	if (!apiKey) {
		throw new PdfOcrError(
			"Mistral OCR is not configured.",
			"PDF_OCR_UNAVAILABLE"
		);
	}

	mistralOcrClient ??= new Mistral({ apiKey });
	return mistralOcrClient;
}

function getMistralOcrModel() {
	return process.env.MISTRAL_OCR_MODEL?.trim() || DEFAULT_MISTRAL_OCR_MODEL;
}

function getPdfOcrMaxBytes() {
	return parsePositiveIntegerEnv(
		"RAG_PDF_OCR_MAX_BYTES",
		DEFAULT_PDF_OCR_MAX_BYTES
	);
}

function normalizeOcrText(text: string) {
	return text
		.replace(/\u0000/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{4,}/g, "\n\n\n")
		.trim();
}

export class MistralPdfOcrProvider implements PdfOcrProvider {
	async extractPdfText(input: PdfOcrInput): Promise<PdfOcrResult> {
		if (input.buffer.byteLength > getPdfOcrMaxBytes()) {
			throw new PdfOcrError(
				"PDF exceeds the OCR size limit.",
				"PDF_OCR_FILE_TOO_LARGE"
			);
		}

		try {
			const response = await getMistralOcrClient().ocr.process({
				model: getMistralOcrModel(),
				document: {
					type: "document_url",
					documentUrl: `data:${input.mimeType ?? "application/pdf"};base64,${input.buffer.toString("base64")}`,
					documentName: input.filename,
				},
				includeImageBase64: false,
				tableFormat: "markdown",
			});

			const pages = [...(response.pages ?? [])].sort(
				(left, right) => left.index - right.index
			);
			const text = normalizeOcrText(
				pages.map((page) => page.markdown).join("\n\n")
			);

			if (!text) {
				throw new PdfOcrError(
					"OCR did not return extractable text.",
					"PDF_OCR_TEXT_EMPTY"
				);
			}

			return {
				text,
				pageCount: pages.length || undefined,
			};
		} catch (error) {
			if (error instanceof PdfOcrError) {
				throw error;
			}

			throw new PdfOcrError("PDF OCR failed.", "PDF_OCR_FAILED");
		}
	}
}

export function getConfiguredPdfOcrProvider(): PdfOcrProvider | null {
	const provider = (process.env.RAG_PDF_OCR_PROVIDER ?? "auto")
		.trim()
		.toLowerCase();

	if (provider === "disabled" || provider === "none") {
		return null;
	}

	if (provider === "auto" && !process.env.MISTRAL_API_KEY?.trim()) {
		return null;
	}

	if (provider === "auto" || provider === "mistral") {
		return new MistralPdfOcrProvider();
	}

	throw new PdfOcrError(
		`Unsupported RAG_PDF_OCR_PROVIDER: ${provider}`,
		"PDF_OCR_PROVIDER_UNSUPPORTED"
	);
}
