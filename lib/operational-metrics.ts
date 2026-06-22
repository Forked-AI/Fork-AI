import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";

type JsonPrimitive = string | number | boolean | null;
export type OperationalMetricJsonValue =
	| JsonPrimitive
	| OperationalMetricJsonValue[]
	| { [key: string]: OperationalMetricJsonValue };

interface OperationalMetricDelegate {
	create(_args: { data: Record<string, unknown> }): Promise<unknown>;
	findMany(_args: Record<string, unknown>): Promise<unknown[]>;
	count(_args: Record<string, unknown>): Promise<number>;
	aggregate(_args: Record<string, unknown>): Promise<Record<string, unknown>>;
	groupBy(_args: Record<string, unknown>): Promise<unknown[]>;
}

export function operationalMetricDelegate() {
	return (
		prisma as unknown as { operationalMetric: OperationalMetricDelegate }
	).operationalMetric;
}

function toJsonValue(value: unknown): OperationalMetricJsonValue | null {
	if (value === undefined) return null;
	return JSON.parse(JSON.stringify(value)) as OperationalMetricJsonValue;
}

export async function recordOperationalMetric(options: {
	kind: string;
	source: string;
	status: string;
	route?: string | null;
	job?: string | null;
	provider?: string | null;
	model?: string | null;
	durationMs?: number | null;
	ttftMs?: number | null;
	tokensPerSec?: number | null;
	totalTokens?: number | null;
	costTotal?: number | null;
	errorCode?: string | null;
	providerStatus?: number | null;
	userId?: string | null;
	organizationId?: string | null;
	conversationId?: string | null;
	traceId?: string | null;
	metadata?: Record<string, unknown> | null;
}) {
	try {
		await operationalMetricDelegate().create({
			data: {
				kind: options.kind,
				source: options.source,
				status: options.status,
				route: options.route ?? null,
				job: options.job ?? null,
				provider: options.provider ?? null,
				model: options.model ?? null,
				durationMs: options.durationMs ?? null,
				ttftMs: options.ttftMs ?? null,
				tokensPerSec: options.tokensPerSec ?? null,
				totalTokens: options.totalTokens ?? null,
				costTotal: options.costTotal ?? null,
				errorCode: options.errorCode ?? null,
				providerStatus: options.providerStatus ?? null,
				userId: options.userId ?? null,
				organizationId: options.organizationId ?? null,
				conversationId: options.conversationId ?? null,
				traceId: options.traceId ?? null,
				metadataJson: toJsonValue(options.metadata ?? null),
			},
		});
	} catch (error) {
		logServerError("operational-metrics", "record_failed", error, {
			kind: options.kind,
			source: options.source,
		});
	}
}
