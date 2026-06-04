import { createHash } from "node:crypto";
import { getRequestFingerprint, hashIdentity } from "@/lib/request-identity";
import { logServerError, logServerInfo, logServerWarning } from "@/lib/server-safe-log";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

const DEFAULT_LOCK_SECONDS = 60;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
	| JsonPrimitive
	| JsonValue[]
	| { [key: string]: JsonValue };

interface StoredIdempotencyRecord {
	id: string;
	scope: string;
	actorKey: string;
	key: string;
	requestHash: string;
	status: "processing" | "completed" | "failed" | string;
	responseStatus: number | null;
	responseBody: JsonValue | null;
	resourceType: string | null;
	resourceId: string | null;
	lockedUntil: Date | null;
	expiresAt: Date;
}

interface IdempotencyRecordDelegate {
	create(args: { data: Record<string, unknown> }): Promise<StoredIdempotencyRecord>;
	findUnique(args: {
		where: { scope_actorKey_key?: { scope: string; actorKey: string; key: string }; id?: string };
	}): Promise<StoredIdempotencyRecord | null>;
	update(args: {
		where: { id: string };
		data: Record<string, unknown>;
	}): Promise<StoredIdempotencyRecord>;
	updateMany(args: {
		where: Record<string, unknown>;
		data: Record<string, unknown>;
	}): Promise<{ count: number }>;
	deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

const idempotencyRecordDelegate = () =>
	(prisma as unknown as { idempotencyRecord: IdempotencyRecordDelegate })
		.idempotencyRecord;

export interface ActiveIdempotencyRecord {
	id: string;
	key: string;
	complete: (
		body: JsonValue,
		options?: {
			status?: number;
			resourceType?: string;
			resourceId?: string;
			ttlSeconds?: number;
		}
	) => Promise<void>;
	fail: (
		body: JsonValue,
		options?: {
			status?: number;
			resourceType?: string;
			resourceId?: string;
			ttlSeconds?: number;
		}
	) => Promise<void>;
}

export type IdempotencyBeginResult =
	| { started: true; record: ActiveIdempotencyRecord }
	| { started: false; response: Response };

export interface BeginIdempotencyOptions {
	scope: string;
	actorKey: string;
	requestInput: unknown;
	lockSeconds?: number;
	ttlSeconds?: number;
	replayResponse?: (record: StoredIdempotencyRecord) => Response | Promise<Response>;
}

export interface IdempotentJsonResult {
	body: unknown;
	status?: number;
	headers?: HeadersInit;
	resourceType?: string;
	resourceId?: string;
}

function getIdempotencyKey(request: Request) {
	const key = request.headers.get(IDEMPOTENCY_KEY_HEADER);
	return key?.trim() ?? "";
}

function normalizeForHash(value: unknown): unknown {
	if (value === undefined) {
		return null;
	}

	if (value === null || typeof value !== "object") {
		return value;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeForHash(item));
	}

	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([, entryValue]) => entryValue !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entryValue]) => [key, normalizeForHash(entryValue)])
	);
}

function hashRequestInput(value: unknown) {
	return createHash("sha256")
		.update(JSON.stringify(normalizeForHash(value)))
		.digest("hex");
}

function isUniqueConstraintError(error: unknown) {
	return (
		!!error &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: unknown }).code === "P2002"
	);
}

function toJsonValue(value: unknown): JsonValue {
	if (value === undefined) {
		return null;
	}

	return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function buildJsonResponse(body: unknown, status: number, replayed = false) {
	return NextResponse.json(toJsonValue(body), {
		status,
		headers: replayed ? { "Idempotency-Replayed": "true" } : undefined,
	});
}

function buildActiveRecord(
	record: Pick<StoredIdempotencyRecord, "id" | "key" | "scope" | "actorKey">,
	defaultTtlSeconds: number
): ActiveIdempotencyRecord {
	const updateOutcome = async (
		status: "completed" | "failed",
		body: JsonValue,
		options: {
			status?: number;
			resourceType?: string;
			resourceId?: string;
			ttlSeconds?: number;
		} = {}
	) => {
		const expiresAt = new Date(
			Date.now() + (options.ttlSeconds ?? defaultTtlSeconds) * 1000
		);

		try {
			await idempotencyRecordDelegate().update({
				where: { id: record.id },
				data: {
					status,
					responseStatus: options.status ?? (status === "failed" ? 500 : 200),
					responseBody: body,
					resourceType: options.resourceType ?? null,
					resourceId: options.resourceId ?? null,
					lockedUntil: null,
					expiresAt,
				},
			});

			logServerInfo("idempotency", status, {
				scope: record.scope,
				actorHash: hashIdentity(record.actorKey),
			});
		} catch (error) {
			logServerError("idempotency", "update_failed", error, {
				scope: record.scope,
				actorHash: hashIdentity(record.actorKey),
			});
		}
	};

	return {
		id: record.id,
		key: record.key,
		complete: (body, options) => updateOutcome("completed", body, options),
		fail: (body, options) => updateOutcome("failed", body, options),
	};
}

async function replayStoredResponse(
	record: StoredIdempotencyRecord,
	options: BeginIdempotencyOptions
) {
	logServerInfo("idempotency", "replayed", {
		scope: options.scope,
		actorHash: hashIdentity(options.actorKey),
		status: record.status,
	});

	if (options.replayResponse) {
		const response = await options.replayResponse(record);
		response.headers.set("Idempotency-Replayed", "true");
		return response;
	}

	return buildJsonResponse(
		record.responseBody ?? null,
		record.responseStatus ?? 200,
		true
	);
}

export function getUserIdempotencyActorKey(userId: string) {
	return `user:${userId}`;
}

export function getRequestIdempotencyActorKey(request: Request, scope = "request") {
	return `${scope}:${getRequestFingerprint(request)}`;
}

export async function cleanupExpiredIdempotencyRecords(now = new Date()) {
	return idempotencyRecordDelegate().deleteMany({
		where: { expiresAt: { lt: now } },
	});
}

export async function beginIdempotency(
	request: Request,
	options: BeginIdempotencyOptions
): Promise<IdempotencyBeginResult> {
	const key = getIdempotencyKey(request);
	if (!key) {
		return {
			started: false,
			response: buildJsonResponse(
				{
					error: "Idempotency-Key header is required.",
					errorCode: "IDEMPOTENCY_KEY_REQUIRED",
				},
				400
			),
		};
	}

	if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
		return {
			started: false,
			response: buildJsonResponse(
				{
					error: "Idempotency-Key header is invalid.",
					errorCode: "IDEMPOTENCY_KEY_INVALID",
				},
				400
			),
		};
	}

	const now = new Date();
	const lockSeconds = options.lockSeconds ?? DEFAULT_LOCK_SECONDS;
	const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
	const lockedUntil = new Date(now.getTime() + lockSeconds * 1000);
	const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
	const requestHash = hashRequestInput(options.requestInput);
	const baseData = {
		scope: options.scope,
		actorKey: options.actorKey,
		key,
		requestHash,
		status: "processing",
		responseStatus: null,
		responseBody: null,
		resourceType: null,
		resourceId: null,
		lockedUntil,
		expiresAt,
	};

	try {
		const record = await idempotencyRecordDelegate().create({
			data: baseData,
		});

		logServerInfo("idempotency", "claimed", {
			scope: options.scope,
			actorHash: hashIdentity(options.actorKey),
		});

		return {
			started: true,
			record: buildActiveRecord(record, ttlSeconds),
		};
	} catch (error) {
		if (!isUniqueConstraintError(error)) {
			throw error;
		}
	}

	const existing = await idempotencyRecordDelegate().findUnique({
		where: {
			scope_actorKey_key: {
				scope: options.scope,
				actorKey: options.actorKey,
				key,
			},
		},
	});

	if (!existing) {
		return beginIdempotency(request, options);
	}

	if (existing.expiresAt <= now) {
		const result = await idempotencyRecordDelegate().updateMany({
			where: { id: existing.id, expiresAt: { lte: now } },
			data: baseData,
		});

		if (result.count === 1) {
			logServerInfo("idempotency", "expired_reclaimed", {
				scope: options.scope,
				actorHash: hashIdentity(options.actorKey),
			});

			return {
				started: true,
				record: buildActiveRecord(
					{ ...existing, ...baseData },
					ttlSeconds
				),
			};
		}
	}

	if (existing.requestHash !== requestHash) {
		logServerWarning("idempotency", "request_hash_conflict", {
			scope: options.scope,
			actorHash: hashIdentity(options.actorKey),
		});

		return {
			started: false,
			response: buildJsonResponse(
				{
					error: "This Idempotency-Key was already used for a different request.",
					errorCode: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
				},
				409
			),
		};
	}

	if (
		(existing.status === "completed" || existing.status === "failed") &&
		existing.responseStatus
	) {
		return {
			started: false,
			response: await replayStoredResponse(existing, options),
		};
	}

	if (!existing.lockedUntil || existing.lockedUntil > now) {
		logServerInfo("idempotency", "in_progress", {
			scope: options.scope,
			actorHash: hashIdentity(options.actorKey),
		});

		return {
			started: false,
			response: NextResponse.json(
				{
					error: "An identical request is already in progress.",
					errorCode: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
				},
				{
					status: 409,
					headers: { "Retry-After": "2" },
				}
			),
		};
	}

	const reclaimed = await idempotencyRecordDelegate().updateMany({
		where: {
			id: existing.id,
			requestHash,
			status: "processing",
			lockedUntil: { lte: now },
		},
		data: {
			status: "processing",
			lockedUntil,
			expiresAt,
		},
	});

	if (reclaimed.count === 1) {
		logServerWarning("idempotency", "expired_lock_recovered", {
			scope: options.scope,
			actorHash: hashIdentity(options.actorKey),
		});

		return {
			started: true,
			record: buildActiveRecord(existing, ttlSeconds),
		};
	}

	return {
		started: false,
		response: NextResponse.json(
			{
				error: "An identical request is already in progress.",
				errorCode: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
			},
			{
				status: 409,
				headers: { "Retry-After": "2" },
			}
		),
	};
}

export async function withJsonIdempotency(
	request: Request,
	options: Omit<BeginIdempotencyOptions, "replayResponse">,
	handler: () => Promise<IdempotentJsonResult>
): Promise<NextResponse> {
	const idempotency = await beginIdempotency(request, options);
	if (!idempotency.started) {
		return idempotency.response as NextResponse;
	}

	try {
		const result = await handler();
		const status = result.status ?? 200;
		const body = toJsonValue(result.body);
		await idempotency.record.complete(body, {
			status,
			resourceType: result.resourceType,
			resourceId: result.resourceId,
			ttlSeconds: options.ttlSeconds,
		});

		return NextResponse.json(body, {
			status,
			headers: result.headers,
		});
	} catch (error) {
		await idempotency.record.fail(
			{
				error: "Internal server error",
				errorCode: "IDEMPOTENT_OPERATION_FAILED",
			},
			{ status: 500, ttlSeconds: options.ttlSeconds }
		);
		throw error;
	}
}
