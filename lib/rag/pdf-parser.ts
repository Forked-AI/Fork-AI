import { inflateRawSync, inflateSync } from "node:zlib";

export interface ParsedPdfText {
	text: string;
	pageCount: number;
}

export class PdfParseError extends Error {
	public readonly errorCode: string;

	constructor(message: string, errorCode: string) {
		super(message);
		this.name = "PdfParseError";
		this.errorCode = errorCode;
	}
}

interface PdfStreamPayload {
	dictionary: string;
	buffer: Buffer;
}

function normalizePdfText(text: string) {
	return text
		.replace(/\u0000/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/\n{4,}/g, "\n\n\n")
		.trim();
}

function decodeUtf16Be(buffer: Buffer) {
	const codePoints: number[] = [];
	for (let index = 0; index + 1 < buffer.length; index += 2) {
		codePoints.push(buffer.readUInt16BE(index));
	}
	return String.fromCharCode(...codePoints);
}

function decodePdfBytes(buffer: Buffer) {
	if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
		return decodeUtf16Be(buffer.subarray(2));
	}

	if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
		return buffer.subarray(2).toString("utf16le");
	}

	return buffer.toString("latin1");
}

function unescapePdfLiteral(value: string) {
	const bytes: number[] = [];

	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (char !== "\\") {
			bytes.push(value.charCodeAt(index) & 0xff);
			continue;
		}

		const next = value[index + 1];
		if (next === undefined) {
			break;
		}

		if (next === "\r" || next === "\n") {
			index += next === "\r" && value[index + 2] === "\n" ? 2 : 1;
			continue;
		}

		if (/[0-7]/.test(next)) {
			const octal =
				value.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] ?? "";
			if (octal) {
				bytes.push(Number.parseInt(octal, 8) & 0xff);
				index += octal.length;
				continue;
			}
		}

		const escapeMap: Record<string, number> = {
			n: 0x0a,
			r: 0x0d,
			t: 0x09,
			b: 0x08,
			f: 0x0c,
			"(": 0x28,
			")": 0x29,
			"\\": 0x5c,
		};
		bytes.push(escapeMap[next] ?? next.charCodeAt(0) & 0xff);
		index += 1;
	}

	return decodePdfBytes(Buffer.from(bytes));
}

function decodePdfHexString(value: string) {
	const normalized = value.replace(/\s+/g, "");
	if (!normalized) return "";
	const evenHex = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
	return decodePdfBytes(Buffer.from(evenHex, "hex"));
}

function decodePdfStringOperand(operand: string) {
	if (operand.startsWith("(") && operand.endsWith(")")) {
		return unescapePdfLiteral(operand.slice(1, -1));
	}

	if (operand.startsWith("<") && operand.endsWith(">")) {
		return decodePdfHexString(operand.slice(1, -1));
	}

	return "";
}

function collectStringOperands(input: string) {
	const values: string[] = [];
	const stringPattern = /\((?:\\.|[^\\)])*\)|<(?!<)(?:[0-9A-Fa-f\s]+)>/g;
	let match: RegExpExecArray | null;

	while ((match = stringPattern.exec(input))) {
		const value = decodePdfStringOperand(match[0]);
		if (value.trim()) {
			values.push(value);
		}
	}

	return values;
}

function collectTextRunsFromContent(content: string) {
	const textRuns: string[] = [];
	const arrayTextPattern = /\[([\s\S]*?)\]\s*TJ\b/g;
	const textOperatorPattern =
		/(\((?:\\.|[^\\)])*\)|<(?!<)(?:[0-9A-Fa-f\s]+)>)\s*(?:Tj\b|'|")/g;
	let match: RegExpExecArray | null;

	while ((match = arrayTextPattern.exec(content))) {
		const values = collectStringOperands(match[1]);
		if (values.length > 0) {
			textRuns.push(values.join(""));
		}
	}

	while ((match = textOperatorPattern.exec(content))) {
		const value = decodePdfStringOperand(match[1]);
		if (value.trim()) {
			textRuns.push(value);
		}
	}

	return textRuns;
}

function getPageCount(raw: string) {
	return Math.max(1, (raw.match(/\/Type\s*\/Page\b/g) ?? []).length);
}

function hasImageOnlySignals(raw: string) {
	return (
		/\/Subtype\s*\/Image\b/.test(raw) ||
		/\/Filter\s*\/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)\b/.test(
			raw
		)
	);
}

function trimPdfStreamBuffer(buffer: Buffer) {
	let start = 0;
	let end = buffer.length;

	if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) {
		start += 2;
	} else if (buffer[start] === 0x0a) {
		start += 1;
	}

	if (buffer[end - 2] === 0x0d && buffer[end - 1] === 0x0a) {
		end -= 2;
	} else if (buffer[end - 1] === 0x0a || buffer[end - 1] === 0x0d) {
		end -= 1;
	}

	return buffer.subarray(start, end);
}

function extractStreams(raw: string): PdfStreamPayload[] {
	const streams: PdfStreamPayload[] = [];
	const streamPattern = /(<<[\s\S]*?>>)\s*stream([\s\S]*?)endstream/g;
	let match: RegExpExecArray | null;

	while ((match = streamPattern.exec(raw))) {
		streams.push({
			dictionary: match[1],
			buffer: trimPdfStreamBuffer(Buffer.from(match[2], "latin1")),
		});
	}

	return streams;
}

function inflatePdfStream(stream: PdfStreamPayload) {
	if (
		!/\/Filter\s*(?:\/FlateDecode|\[[^\]]*\/FlateDecode)/.test(
			stream.dictionary
		)
	) {
		return stream.buffer;
	}

	try {
		return inflateSync(stream.buffer);
	} catch {
		return inflateRawSync(stream.buffer);
	}
}

export function parsePdfText(buffer: Buffer): ParsedPdfText {
	const raw = buffer.toString("latin1");

	if (!raw.startsWith("%PDF-")) {
		throw new PdfParseError(
			"The uploaded PDF is not valid.",
			"PDF_INVALID"
		);
	}

	if (/\/Encrypt\b/.test(raw)) {
		throw new PdfParseError(
			"Encrypted PDFs are not supported for text extraction.",
			"PDF_ENCRYPTED_UNSUPPORTED"
		);
	}

	const textRuns = collectTextRunsFromContent(raw);
	for (const stream of extractStreams(raw)) {
		try {
			textRuns.push(
				...collectTextRunsFromContent(
					inflatePdfStream(stream).toString("latin1")
				)
			);
		} catch {
			throw new PdfParseError(
				"PDF stream text extraction failed.",
				"PDF_STREAM_EXTRACTION_FAILED"
			);
		}
	}

	const text = normalizePdfText(textRuns.join(" "));
	if (!text) {
		throw new PdfParseError(
			hasImageOnlySignals(raw)
				? "This PDF appears to be scanned or image-only and has no extractable text."
				: "No extractable PDF text was found.",
			hasImageOnlySignals(raw)
				? "PDF_SCANNED_TEXT_UNAVAILABLE"
				: "PDF_TEXT_EMPTY"
		);
	}

	return {
		text,
		pageCount: getPageCount(raw),
	};
}
