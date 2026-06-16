import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
	UploadPartCommand,
	type CompletedPart,
	type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type SupportedFileStorageProvider = "local" | "r2";

export interface StoredFileObject {
	storageProvider: SupportedFileStorageProvider;
	storageKey: string;
	checksumSha256: string;
}

export interface StoredFileReference {
	storageProvider: string;
	storageKey: string;
}

export interface MultipartUploadPartUrl {
	partNumber: number;
	startByte: number;
	endByte: number;
	url: string;
}

const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), ".data", "files");
const R2_REGION = "auto";
const MIN_MULTIPART_PART_BYTES = 5 * 1024 * 1024;
const DEFAULT_DIRECT_UPLOAD_PART_BYTES = 8 * 1024 * 1024;
const DEFAULT_DIRECT_UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DEFAULT_PRESIGNED_READ_URL_TTL_SECONDS = 5 * 60;

let r2Client: S3Client | null = null;

function getStorageRoot() {
	return path.resolve(process.env.FILE_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT);
}

export function getConfiguredFileStorageProvider(): SupportedFileStorageProvider {
	const provider = (process.env.FILE_STORAGE_PROVIDER ?? "local")
		.trim()
		.toLowerCase();

	if (provider === "local" || provider === "r2") {
		return provider;
	}

	throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${provider}`);
}

function assertSupportedStorageProvider(
	storageProvider: string
): SupportedFileStorageProvider {
	if (storageProvider === "local" || storageProvider === "r2") {
		return storageProvider;
	}

	throw new Error(`Unsupported storage provider: ${storageProvider}`);
}

function assertLocalStorageKey(storageKey: string) {
	const storageRoot = getStorageRoot();
	const resolved = path.resolve(storageRoot, storageKey);

	if (!resolved.startsWith(`${storageRoot}${path.sep}`)) {
		throw new Error("Invalid local storage key");
	}

	return resolved;
}

function getR2Endpoint() {
	const explicitEndpoint = process.env.R2_ENDPOINT?.trim();
	if (explicitEndpoint) {
		return explicitEndpoint;
	}

	const accountId = process.env.R2_ACCOUNT_ID?.trim();
	if (!accountId) {
		throw new Error("R2_ACCOUNT_ID or R2_ENDPOINT is required");
	}

	return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getRequiredR2ConfigValue(name: string) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required for R2 file storage`);
	}

	return value;
}

function getR2BucketName() {
	return getRequiredR2ConfigValue("R2_BUCKET_NAME");
}

function getR2Client() {
	if (r2Client) {
		return r2Client;
	}

	r2Client = new S3Client({
		region: R2_REGION,
		endpoint: getR2Endpoint(),
		forcePathStyle: true,
		credentials: {
			accessKeyId: getRequiredR2ConfigValue("R2_ACCESS_KEY_ID"),
			secretAccessKey: getRequiredR2ConfigValue("R2_SECRET_ACCESS_KEY"),
		},
	});

	return r2Client;
}

function parsePositiveIntegerEnv(name: string, fallback: number) {
	const value = Number(process.env[name]);
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getDirectUploadPartBytes() {
	return Math.max(
		MIN_MULTIPART_PART_BYTES,
		parsePositiveIntegerEnv(
			"DIRECT_UPLOAD_PART_BYTES",
			DEFAULT_DIRECT_UPLOAD_PART_BYTES
		)
	);
}

function getDirectUploadUrlTtlSeconds() {
	return parsePositiveIntegerEnv(
		"DIRECT_UPLOAD_URL_TTL_SECONDS",
		DEFAULT_DIRECT_UPLOAD_URL_TTL_SECONDS
	);
}

function getR2KeyPrefix() {
	const prefix = process.env.R2_KEY_PREFIX?.trim();
	if (!prefix) {
		return "";
	}

	const normalized = prefix
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean);

	if (normalized.some((segment) => segment === "." || segment === "..")) {
		throw new Error("R2_KEY_PREFIX cannot include traversal segments");
	}

	return normalized.join("/");
}

export function buildStoredFileKey({
	userId,
	fileId,
	extension,
}: {
	userId: string;
	fileId: string;
	extension: string;
}) {
	const safeUserId = userId.replace(/[^A-Za-z0-9_-]/g, "_");
	const safeFileId = fileId.replace(/[^A-Za-z0-9_-]/g, "_");
	const safeExtension = extension.replace(/[^a-z0-9.]/g, "") || ".bin";
	const relativeKey = path.posix.join(
		safeUserId,
		`${safeFileId}${safeExtension}`
	);

	if (getConfiguredFileStorageProvider() !== "r2") {
		return relativeKey;
	}

	const prefix = getR2KeyPrefix();
	return prefix ? path.posix.join(prefix, relativeKey) : relativeKey;
}

export function buildLocalStorageKey(input: {
	userId: string;
	fileId: string;
	extension: string;
}) {
	return buildStoredFileKey(input);
}

export async function saveLocalFileObject({
	storageKey,
	buffer,
}: {
	storageKey: string;
	buffer: Buffer;
}): Promise<StoredFileObject> {
	const absolutePath = assertLocalStorageKey(storageKey);
	await fs.mkdir(path.dirname(absolutePath), { recursive: true });
	await fs.writeFile(absolutePath, buffer, { flag: "wx" });

	return {
		storageProvider: "local",
		storageKey,
		checksumSha256: createHash("sha256").update(buffer).digest("hex"),
	};
}

async function saveR2FileObject({
	storageKey,
	buffer,
}: {
	storageKey: string;
	buffer: Buffer;
}): Promise<StoredFileObject> {
	await getR2Client().send(
		new PutObjectCommand({
			Bucket: getR2BucketName(),
			Key: storageKey,
			Body: buffer,
			ContentLength: buffer.byteLength,
		})
	);

	return {
		storageProvider: "r2",
		storageKey,
		checksumSha256: createHash("sha256").update(buffer).digest("hex"),
	};
}

export async function saveFileObject({
	storageKey,
	buffer,
}: {
	storageKey: string;
	buffer: Buffer;
}): Promise<StoredFileObject> {
	if (getConfiguredFileStorageProvider() === "r2") {
		return saveR2FileObject({ storageKey, buffer });
	}

	return saveLocalFileObject({ storageKey, buffer });
}

function assertR2StorageReference(reference: StoredFileReference) {
	const storageProvider = assertSupportedStorageProvider(
		reference.storageProvider
	);
	if (storageProvider !== "r2") {
		throw new Error("Operation is only supported for R2 storage");
	}
}

export function isR2DirectUploadAvailable() {
	return getConfiguredFileStorageProvider() === "r2";
}

export async function createR2MultipartUpload({
	storageKey,
	mimeType,
	sizeBytes,
}: {
	storageKey: string;
	mimeType: string;
	sizeBytes: number;
}) {
	if (!isR2DirectUploadAvailable()) {
		throw new Error("Direct uploads are only supported for R2 storage");
	}

	const partSizeBytes = getDirectUploadPartBytes();
	const partCount = Math.max(1, Math.ceil(sizeBytes / partSizeBytes));
	const { UploadId } = await getR2Client().send(
		new CreateMultipartUploadCommand({
			Bucket: getR2BucketName(),
			Key: storageKey,
			ContentType: mimeType,
		})
	);

	if (!UploadId) {
		throw new Error("R2 did not return a multipart upload ID");
	}

	try {
		const parts: MultipartUploadPartUrl[] = [];
		for (let index = 0; index < partCount; index += 1) {
			const startByte = index * partSizeBytes;
			const endByte = Math.min(startByte + partSizeBytes, sizeBytes);
			const partNumber = index + 1;
			const url = await getSignedUrl(
				getR2Client(),
				new UploadPartCommand({
					Bucket: getR2BucketName(),
					Key: storageKey,
					UploadId,
					PartNumber: partNumber,
				}),
				{ expiresIn: getDirectUploadUrlTtlSeconds() }
			);
			parts.push({ partNumber, startByte, endByte, url });
		}

		return {
			uploadId: UploadId,
			partSizeBytes,
			expiresInSeconds: getDirectUploadUrlTtlSeconds(),
			parts,
		};
	} catch (error) {
		await getR2Client()
			.send(
				new AbortMultipartUploadCommand({
					Bucket: getR2BucketName(),
					Key: storageKey,
					UploadId,
				})
			)
			.catch(() => undefined);
		throw error;
	}
}

export async function completeR2MultipartUpload({
	reference,
	uploadId,
	parts,
}: {
	reference: StoredFileReference;
	uploadId: string;
	parts: Array<{ partNumber: number; etag: string }>;
}) {
	assertR2StorageReference(reference);
	const completedParts: CompletedPart[] = parts
		.map((part) => ({
			PartNumber: part.partNumber,
			ETag: part.etag,
		}))
		.sort(
			(left, right) => (left.PartNumber ?? 0) - (right.PartNumber ?? 0)
		);

	await getR2Client().send(
		new CompleteMultipartUploadCommand({
			Bucket: getR2BucketName(),
			Key: reference.storageKey,
			UploadId: uploadId,
			MultipartUpload: {
				Parts: completedParts,
			},
		})
	);
}

export async function abortR2MultipartUpload({
	reference,
	uploadId,
}: {
	reference: StoredFileReference;
	uploadId: string;
}) {
	assertR2StorageReference(reference);
	await getR2Client().send(
		new AbortMultipartUploadCommand({
			Bucket: getR2BucketName(),
			Key: reference.storageKey,
			UploadId: uploadId,
		})
	);
}

export async function getPresignedStoredFileUrl(
	reference: StoredFileReference,
	expiresInSeconds = DEFAULT_PRESIGNED_READ_URL_TTL_SECONDS
) {
	assertR2StorageReference(reference);
	return getSignedUrl(
		getR2Client(),
		new GetObjectCommand({
			Bucket: getR2BucketName(),
			Key: reference.storageKey,
		}),
		{ expiresIn: expiresInSeconds }
	);
}

async function getBodyBuffer(body: GetObjectCommandOutput["Body"]) {
	if (!body) {
		throw new Error("Stored object response did not include a body");
	}

	const transformable = body as {
		transformToByteArray?: () => Promise<Uint8Array>;
	};
	if (typeof transformable.transformToByteArray === "function") {
		return Buffer.from(await transformable.transformToByteArray());
	}

	const chunks: Buffer[] = [];
	for await (const chunk of body as AsyncIterable<
		Buffer | Uint8Array | string
	>) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	return Buffer.concat(chunks);
}

async function readR2FileObject(reference: StoredFileReference) {
	const response = await getR2Client().send(
		new GetObjectCommand({
			Bucket: getR2BucketName(),
			Key: reference.storageKey,
		})
	);

	return getBodyBuffer(response.Body);
}

export async function readStoredFileObject(reference: StoredFileReference) {
	const storageProvider = assertSupportedStorageProvider(
		reference.storageProvider
	);

	if (storageProvider === "r2") {
		return readR2FileObject(reference);
	}

	return fs.readFile(assertLocalStorageKey(reference.storageKey));
}

async function deleteLocalFileObject(reference: StoredFileReference) {
	await fs
		.unlink(assertLocalStorageKey(reference.storageKey))
		.catch((error) => {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
		});
}

async function deleteR2FileObject(reference: StoredFileReference) {
	await getR2Client().send(
		new DeleteObjectCommand({
			Bucket: getR2BucketName(),
			Key: reference.storageKey,
		})
	);
}

export async function deleteStoredFileObject(reference: StoredFileReference) {
	const storageProvider = assertSupportedStorageProvider(
		reference.storageProvider
	);

	if (storageProvider === "r2") {
		await deleteR2FileObject(reference);
		return;
	}

	await deleteLocalFileObject(reference);
}

export async function deleteStoredFileObjects(
	references: StoredFileReference[]
) {
	for (const reference of references) {
		await deleteStoredFileObject(reference);
	}
}
