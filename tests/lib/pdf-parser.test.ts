import { deflateSync } from "node:zlib";
import { parsePdfText, PdfParseError } from "@/lib/rag/pdf-parser";
import { describe, expect, it } from "vitest";

function buildCompressedPdf(contentStream: string) {
	const compressed = deflateSync(Buffer.from(contentStream, "latin1"));
	return Buffer.concat([
		Buffer.from(
			[
				"%PDF-1.4",
				"1 0 obj",
				"<< /Type /Page >>",
				"endobj",
				"2 0 obj",
				`<< /Length ${compressed.length} /Filter /FlateDecode >>`,
				"stream\n",
			].join("\n"),
			"latin1"
		),
		compressed,
		Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
	]);
}

describe("PDF parser", () => {
	it("extracts text from Flate-compressed PDF text streams", () => {
		const pdf = buildCompressedPdf(
			"BT /F1 12 Tf 72 720 Td (Compressed PDF text) Tj ET"
		);

		expect(parsePdfText(pdf)).toMatchObject({
			text: "Compressed PDF text",
			pageCount: 1,
		});
	});

	it("extracts TJ array text and hex string text", () => {
		const pdf = buildCompressedPdf(
			"BT [(Budget ) 20 (policy)] TJ <486578> Tj ET"
		);

		expect(parsePdfText(pdf).text).toContain("Budget policy");
		expect(parsePdfText(pdf).text).toContain("Hex");
	});

	it("returns a specific error for scanned or image-only PDFs", () => {
		const pdf = Buffer.from(
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

		expect(() => parsePdfText(pdf)).toThrow(PdfParseError);
		try {
			parsePdfText(pdf);
		} catch (error) {
			expect(error).toMatchObject({
				errorCode: "PDF_SCANNED_TEXT_UNAVAILABLE",
			});
		}
	});
});
