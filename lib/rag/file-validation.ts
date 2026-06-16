import path from "node:path";

export type DocumentFileContentKind =
	| "pdf"
	| "text"
	| "markdown"
	| "csv"
	| "code";
export type FileContentKind = DocumentFileContentKind | "image";
export type FileObjectPurpose = "rag_document" | "vision_image";

export interface ValidatedUploadFile {
	filename: string;
	extension: string;
	mimeType: string;
	sizeBytes: number;
	kind: FileContentKind;
	purpose: FileObjectPurpose;
}

export class FileValidationError extends Error {
	public readonly errorCode: string;
	public readonly status: number;

	constructor(message: string, errorCode: string, status = 400) {
		super(message);
		this.name = "FileValidationError";
		this.errorCode = errorCode;
		this.status = status;
	}
}

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

const CODE_EXTENSIONS = new Set([
	".c",
	".cpp",
	".cs",
	".css",
	".go",
	".html",
	".java",
	".js",
	".jsx",
	".json",
	".kt",
	".php",
	".py",
	".rb",
	".rs",
	".sh",
	".sql",
	".ts",
	".tsx",
	".xml",
	".yaml",
	".yml",
]);

const MIME_BY_KIND: Record<FileContentKind, Set<string>> = {
	pdf: new Set(["application/pdf"]),
	text: new Set(["text/plain"]),
	markdown: new Set(["text/markdown", "text/x-markdown", "text/plain"]),
	csv: new Set(["text/csv", "application/csv", "text/plain"]),
	code: new Set([
		"application/javascript",
		"application/json",
		"application/octet-stream",
		"application/sql",
		"application/xml",
		"text/css",
		"text/html",
		"text/javascript",
		"text/plain",
		"text/x-python",
		"text/xml",
	]),
	image: new Set(["image/jpeg", "image/png", "image/webp"]),
};

function parseMaxUploadBytes(envName: string, fallback: number) {
	const configured = Number(process.env[envName]);
	return Number.isFinite(configured) && configured > 0
		? configured
		: fallback;
}

export function sanitizeUploadFilename(filename: string) {
	const base = path.basename(filename).replace(/[\x00-\x1f\x7f]/g, "");
	const normalized = base.replace(/\s+/g, " ").trim();
	return normalized.slice(0, 180) || "upload.txt";
}

function getKindForExtension(extension: string): FileContentKind | null {
	if (extension === ".pdf") return "pdf";
	if (extension === ".txt") return "text";
	if (extension === ".md" || extension === ".markdown") return "markdown";
	if (extension === ".csv") return "csv";
	if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
		return "image";
	}
	if (CODE_EXTENSIONS.has(extension)) return "code";
	return null;
}

function mimeMatchesKind(mimeType: string, kind: FileContentKind) {
	if (!mimeType) {
		return kind !== "pdf";
	}

	return MIME_BY_KIND[kind].has(mimeType);
}

function getDefaultMimeType(kind: FileContentKind) {
	switch (kind) {
		case "pdf":
			return "application/pdf";
		case "markdown":
			return "text/markdown";
		case "csv":
			return "text/csv";
		case "code":
			return "text/plain";
		case "image":
			return "image/png";
		case "text":
		default:
			return "text/plain";
	}
}

function getImageMimeFromMagicBytes(buffer: Buffer) {
	if (
		buffer.length >= 8 &&
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	) {
		return "image/png";
	}

	if (
		buffer.length >= 3 &&
		buffer[0] === 0xff &&
		buffer[1] === 0xd8 &&
		buffer[2] === 0xff
	) {
		return "image/jpeg";
	}

	if (
		buffer.length >= 12 &&
		buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
		buffer.subarray(8, 12).toString("ascii") === "WEBP"
	) {
		return "image/webp";
	}

	return null;
}

function assertImageMagicBytes({
	buffer,
	mimeType,
	extension,
}: {
	buffer: Buffer | undefined;
	mimeType: string;
	extension: string;
}) {
	if (!buffer) {
		throw new FileValidationError(
			"Image uploads require server-side content validation.",
			"IMAGE_CONTENT_VALIDATION_REQUIRED"
		);
	}

	const detectedMimeType = getImageMimeFromMagicBytes(buffer);
	if (!detectedMimeType) {
		throw new FileValidationError(
			"Image content does not match a supported PNG, JPEG, or WebP file.",
			"IMAGE_MAGIC_BYTES_MISMATCH"
		);
	}

	if (mimeType && detectedMimeType !== mimeType) {
		throw new FileValidationError(
			"Image MIME type does not match the uploaded content.",
			"IMAGE_MIME_CONTENT_MISMATCH"
		);
	}

	if (
		(extension === ".png" && detectedMimeType !== "image/png") ||
		((extension === ".jpg" || extension === ".jpeg") &&
			detectedMimeType !== "image/jpeg") ||
		(extension === ".webp" && detectedMimeType !== "image/webp")
	) {
		throw new FileValidationError(
			"Image extension does not match the uploaded content.",
			"IMAGE_EXTENSION_CONTENT_MISMATCH"
		);
	}

	return detectedMimeType;
}

export function validateUploadFile(
	file: Pick<File, "name" | "size" | "type">,
	filenameOverride?: string,
	options: {
		allowImages?: boolean;
		buffer?: Buffer;
		validateContent?: boolean;
	} = {}
): ValidatedUploadFile {
	const filename = sanitizeUploadFilename(filenameOverride || file.name);
	const extension = path.extname(filename).toLowerCase();
	const kind = getKindForExtension(extension);
	const rawMimeType = (file.type || "").toLowerCase();
	const sizeBytes = file.size;

	if (!kind || (kind === "image" && !options.allowImages)) {
		throw new FileValidationError(
			"Unsupported file type.",
			"FILE_TYPE_UNSUPPORTED"
		);
	}

	const maxUploadBytes =
		kind === "image"
			? parseMaxUploadBytes(
					"IMAGE_UPLOAD_MAX_BYTES",
					DEFAULT_MAX_IMAGE_UPLOAD_BYTES
				)
			: parseMaxUploadBytes(
					"FILE_UPLOAD_MAX_BYTES",
					DEFAULT_MAX_UPLOAD_BYTES
				);

	if (sizeBytes <= 0) {
		throw new FileValidationError("File is empty.", "FILE_EMPTY");
	}

	if (sizeBytes > maxUploadBytes) {
		throw new FileValidationError(
			"File exceeds the upload size limit.",
			"FILE_TOO_LARGE",
			413
		);
	}

	if (!mimeMatchesKind(rawMimeType, kind)) {
		throw new FileValidationError(
			"File MIME type does not match the extension.",
			"FILE_MIME_EXTENSION_MISMATCH"
		);
	}

	const shouldValidateContent = options.validateContent !== false;
	let mimeType: string;
	if (kind === "image") {
		if (shouldValidateContent) {
			mimeType = assertImageMagicBytes({
				buffer: options.buffer,
				mimeType: rawMimeType,
				extension,
			});
		} else {
			if (!rawMimeType) {
				throw new FileValidationError(
					"Image MIME type is required for direct uploads.",
					"IMAGE_MIME_REQUIRED"
				);
			}
			mimeType = rawMimeType;
		}
	} else {
		mimeType = rawMimeType || getDefaultMimeType(kind);
	}

	return {
		filename,
		extension,
		mimeType,
		sizeBytes,
		kind,
		purpose: kind === "image" ? "vision_image" : "rag_document",
	};
}
