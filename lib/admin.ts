import { auth } from "@/lib/auth";
import {
	operationalMetricDelegate,
	recordOperationalMetric,
} from "@/lib/operational-metrics";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export interface AdminSession {
	user: {
		id: string;
		email?: string | null;
		name?: string | null;
		role?: string | null;
	};
}

export type AdminAuthResult =
	| { ok: true; session: AdminSession }
	| { ok: false; response: NextResponse };

type JsonPrimitive = string | number | boolean | null;
export type AdminJsonValue =
	| JsonPrimitive
	| AdminJsonValue[]
	| { [key: string]: AdminJsonValue };

interface AdminAuditEventDelegate {
	create(_args: { data: Record<string, unknown> }): Promise<unknown>;
	findMany(_args: Record<string, unknown>): Promise<unknown[]>;
	count(_args: Record<string, unknown>): Promise<number>;
}

export function adminAuditDelegate() {
	return (prisma as unknown as { adminAuditEvent: AdminAuditEventDelegate })
		.adminAuditEvent;
}

export async function requireAdminSession(
	request: Request
): Promise<AdminAuthResult> {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user?.id) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			),
		};
	}

	const user = session.user as AdminSession["user"];
	if (user.role !== "admin") {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Forbidden" },
				{ status: 403 }
			),
		};
	}

	return { ok: true, session: { user } };
}

export function getIdempotencyKey(request: Request) {
	return request.headers.get("Idempotency-Key")?.trim() || null;
}

export function getRequestId(request: Request) {
	return (
		request.headers.get("x-request-id")?.trim() ||
		request.headers.get("x-vercel-id")?.trim() ||
		null
	);
}

export function toAdminJsonValue(value: unknown): AdminJsonValue | null {
	if (value === undefined) return null;
	return JSON.parse(JSON.stringify(value)) as AdminJsonValue;
}

export async function recordAdminAuditEvent(options: {
	actorId: string;
	action: string;
	targetType: string;
	targetId?: string | null;
	request?: Request;
	metadata?: Record<string, unknown> | null;
}) {
	try {
		await adminAuditDelegate().create({
			data: {
				actorId: options.actorId,
				action: options.action,
				targetType: options.targetType,
				targetId: options.targetId ?? null,
				requestId: options.request
					? getRequestId(options.request)
					: null,
				idempotencyKey: options.request
					? getIdempotencyKey(options.request)
					: null,
				metadataJson: toAdminJsonValue(options.metadata ?? null),
			},
		});
	} catch (error) {
		logServerError("admin/audit", "record_failed", error, {
			action: options.action,
			targetType: options.targetType,
		});
	}
}

export { operationalMetricDelegate, recordOperationalMetric };

export function getDefaultAdminWindow(days = 30) {
	const now = new Date();
	return {
		from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
		to: now,
	};
}

export function parseAdminDateWindow(options: {
	from?: string;
	to?: string;
	defaultDays?: number;
}) {
	const defaults = getDefaultAdminWindow(options.defaultDays ?? 30);
	const from = options.from ? new Date(options.from) : defaults.from;
	const to = options.to ? new Date(options.to) : defaults.to;

	if (
		Number.isNaN(from.getTime()) ||
		Number.isNaN(to.getTime()) ||
		from >= to
	) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: "The from date must be before the to date." },
				{ status: 400 }
			),
		};
	}

	return { ok: true as const, from, to };
}

export function getAdminMetricRetentionDays() {
	const parsed = Number.parseInt(
		process.env.ADMIN_METRIC_RETENTION_DAYS ?? "90",
		10
	);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}
