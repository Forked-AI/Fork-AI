import {
	beginIdempotency,
	cleanupExpiredIdempotencyRecords,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { beforeEach, describe, expect, it, vi } from "vitest";

type RecordStatus = "processing" | "completed" | "failed";

interface TestRecord {
	id: string;
	scope: string;
	actorKey: string;
	key: string;
	requestHash: string;
	status: RecordStatus;
	responseStatus: number | null;
	responseBody: unknown;
	resourceType: string | null;
	resourceId: string | null;
	lockedUntil: Date | null;
	expiresAt: Date;
}

const records = new Map<string, TestRecord>();

function uniqueKey(scope: string, actorKey: string, key: string) {
	return `${scope}:${actorKey}:${key}`;
}

const prismaMocks = vi.hoisted(() => ({
	create: vi.fn(),
	findUnique: vi.fn(),
	update: vi.fn(),
	updateMany: vi.fn(),
	deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		idempotencyRecord: prismaMocks,
	},
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
	logServerWarning: vi.fn(),
}));

function requestWithKey(key?: string, body: unknown = {}) {
	return new Request("http://localhost/api/test", {
		method: "POST",
		headers: key ? { "Idempotency-Key": key } : undefined,
		body: JSON.stringify(body),
	});
}

describe("idempotency helper", () => {
	beforeEach(() => {
		records.clear();
		vi.clearAllMocks();

		prismaMocks.create.mockImplementation(({ data }) => {
			const id = `record-${records.size + 1}`;
			const record: TestRecord = {
				id,
				scope: String(data.scope),
				actorKey: String(data.actorKey),
				key: String(data.key),
				requestHash: String(data.requestHash),
				status: data.status as RecordStatus,
				responseStatus: null,
				responseBody: null,
				resourceType: null,
				resourceId: null,
				lockedUntil: data.lockedUntil as Date,
				expiresAt: data.expiresAt as Date,
			};
			const mapKey = uniqueKey(record.scope, record.actorKey, record.key);
			if (records.has(mapKey)) {
				throw { code: "P2002" };
			}

			records.set(mapKey, record);
			return record;
		});

		prismaMocks.findUnique.mockImplementation(({ where }) => {
			if (where.id) {
				return (
					Array.from(records.values()).find(
						(record) => record.id === where.id
					) ?? null
				);
			}

			const unique = where.scope_actorKey_key;
			return (
				records.get(uniqueKey(unique.scope, unique.actorKey, unique.key)) ??
				null
			);
		});

		prismaMocks.update.mockImplementation(({ where, data }) => {
			const record = Array.from(records.values()).find(
				(entry) => entry.id === where.id
			);
			if (!record) {
				throw new Error("Record not found");
			}

			Object.assign(record, data);
			return record;
		});

		prismaMocks.updateMany.mockResolvedValue({ count: 0 });
		prismaMocks.deleteMany.mockResolvedValue({ count: 2 });
	});

	it("rejects missing keys before running the handler", async () => {
		const handler = vi.fn();

		const response = await withJsonIdempotency(
			requestWithKey(undefined),
			{
				scope: "test",
				actorKey: "user:1",
				requestInput: { value: 1 },
			},
			handler
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			errorCode: "IDEMPOTENCY_KEY_REQUIRED",
		});
		expect(handler).not.toHaveBeenCalled();
	});

	it("replays a completed response for the same key and request", async () => {
		const first = await withJsonIdempotency(
			requestWithKey("same-key"),
			{
				scope: "test",
				actorKey: "user:1",
				requestInput: { value: 1 },
			},
			async () => ({
				status: 201,
				body: { ok: true, id: "resource-1" },
				resourceType: "resource",
				resourceId: "resource-1",
			})
		);

		const second = await withJsonIdempotency(
			requestWithKey("same-key"),
			{
				scope: "test",
				actorKey: "user:1",
				requestInput: { value: 1 },
			},
			async () => ({ body: { ok: false } })
		);

		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
		expect(second.headers.get("Idempotency-Replayed")).toBe("true");
		expect(await second.json()).toEqual({ ok: true, id: "resource-1" });
	});

	it("rejects reuse of a key with a different request body", async () => {
		const first = await beginIdempotency(requestWithKey("conflict-key"), {
			scope: "test",
			actorKey: "user:1",
			requestInput: { value: 1 },
		});
		expect(first.started).toBe(true);

		const second = await beginIdempotency(requestWithKey("conflict-key"), {
			scope: "test",
			actorKey: "user:1",
			requestInput: { value: 2 },
		});

		expect(second.started).toBe(false);
		if (!second.started) {
			expect(second.response.status).toBe(409);
			expect(await second.response.json()).toMatchObject({
				errorCode: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
			});
		}
	});

	it("returns in-progress while the first request still owns the lock", async () => {
		const first = await beginIdempotency(requestWithKey("busy-key"), {
			scope: "test",
			actorKey: "user:1",
			requestInput: { value: 1 },
		});
		expect(first.started).toBe(true);

		const second = await beginIdempotency(requestWithKey("busy-key"), {
			scope: "test",
			actorKey: "user:1",
			requestInput: { value: 1 },
		});

		expect(second.started).toBe(false);
		if (!second.started) {
			expect(second.response.status).toBe(409);
			expect(second.response.headers.get("Retry-After")).toBe("2");
			expect(await second.response.json()).toMatchObject({
				errorCode: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
			});
		}
	});

	it("exposes cleanup for expired records", async () => {
		const result = await cleanupExpiredIdempotencyRecords(
			new Date("2026-05-28T00:00:00.000Z")
		);

		expect(result.count).toBe(2);
		expect(prismaMocks.deleteMany).toHaveBeenCalledWith({
			where: { expiresAt: { lt: new Date("2026-05-28T00:00:00.000Z") } },
		});
	});
});
