import { prisma } from "@/lib/prisma";
import { recordOperationalMetric } from "@/lib/operational-metrics";
import { defaultToolRegistry } from "@/lib/tools/registry";
import { ToolExecutionError } from "@/lib/tools/errors";
import {
	sanitizeToolResult,
	stableToolInputHash,
	toToolJsonValue,
} from "@/lib/tools/sanitizer";
import type {
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionRecord,
	ToolExecutionStatus,
	ToolJsonValue,
	ToolPrismaClient,
	ToolRegistry,
} from "@/lib/tools/types";
import { logServerError, logServerWarning } from "@/lib/server-safe-log";

const DEFAULT_INVALID_RISK = "low";
const CONTEXT_TIMEOUT_ERROR = "TOOL_EXECUTION_TIMED_OUT";
const CONTEXT_UNAUTHORIZED_ERROR = "TOOL_CONTEXT_UNAUTHORIZED";

export interface ToolRouterOptions {
	prismaClient?: ToolPrismaClient;
	registry?: ToolRegistry;
}

export interface ToolRequestInput {
	toolName: string;
	input: unknown;
	context: ToolExecutionContext;
}

export interface ConfirmToolInput {
	executionId: string;
	input: unknown;
	context: ToolExecutionContext;
}

export interface CancelToolInput {
	executionId: string;
	context: ToolExecutionContext;
}

export type ToolRouterResult =
	| { ok: true; execution: ToolExecutionRecord }
	| {
			ok: false;
			status: number;
			error: string;
			errorCode: string;
			execution?: ToolExecutionRecord | null;
	  };

function now() {
	return new Date();
}

function toolDelegate(prismaClient: ToolPrismaClient = prisma as any) {
	return prismaClient.toolExecution;
}

function auditMetadata(value: Record<string, unknown>): ToolJsonValue {
	return toToolJsonValue(value);
}

async function createTerminalAudit(options: {
	prismaClient: ToolPrismaClient;
	toolName: string;
	context: ToolExecutionContext;
	status: ToolExecutionStatus;
	errorCode: string;
	inputSummary?: ToolJsonValue | null;
	metadata?: Record<string, unknown>;
	definition?: ToolDefinition | null;
}) {
	const completedAt = now();
	return toolDelegate(options.prismaClient).create({
		data: {
			userId: options.context.userId,
			organizationId: options.context.organizationId ?? null,
			conversationId: options.context.conversationId ?? null,
			messageId: options.context.messageId ?? null,
			toolName: options.toolName,
			status: options.status,
			riskLevel: options.definition?.riskLevel ?? DEFAULT_INVALID_RISK,
			requiresConfirmation:
				options.definition?.requiresConfirmation ?? false,
			inputSummaryJson: options.inputSummary ?? null,
			auditMetadata: auditMetadata(options.metadata ?? {}),
			errorCode: options.errorCode,
			startedAt: completedAt,
			completedAt,
		},
	});
}

async function markExecution(
	prismaClient: ToolPrismaClient,
	id: string,
	data: Record<string, unknown>
) {
	return toolDelegate(prismaClient).update({
		where: { id },
		data,
	});
}

async function executeWithTimeout<T>(
	execute: (_signal: AbortSignal) => Promise<T>,
	timeoutMs: number
): Promise<T> {
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | null = null;
	try {
		return await Promise.race([
			execute(controller.signal),
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => {
					controller.abort(CONTEXT_TIMEOUT_ERROR);
					reject(new Error(CONTEXT_TIMEOUT_ERROR));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

async function authorizeExecutionContext(
	prismaClient: ToolPrismaClient,
	context: ToolExecutionContext
) {
	if (context.conversationId) {
		const conversation = await prismaClient.conversation.findFirst({
			where: {
				id: context.conversationId,
				userId: context.userId,
				organizationId: context.organizationId ?? null,
			},
			select: { id: true },
		});
		if (!conversation) {
			return {
				ok: false as const,
				errorCode: CONTEXT_UNAUTHORIZED_ERROR,
			};
		}
	}

	if (context.messageId) {
		const message = await prismaClient.message.findFirst({
			where: {
				id: context.messageId,
				...(context.conversationId
					? { conversationId: context.conversationId }
					: {}),
				conversation: {
					userId: context.userId,
					organizationId: context.organizationId ?? null,
				},
			},
			select: { id: true, conversationId: true },
		});
		if (!message) {
			return {
				ok: false as const,
				errorCode: CONTEXT_UNAUTHORIZED_ERROR,
			};
		}
	}

	return { ok: true as const };
}

async function createUnauthorizedContextAudit(options: {
	prismaClient: ToolPrismaClient;
	toolName: string;
	context: ToolExecutionContext;
	errorCode: string;
	definition?: ToolDefinition | null;
}) {
	const execution = await createTerminalAudit({
		prismaClient: options.prismaClient,
		toolName: options.toolName,
		context: { userId: options.context.userId },
		status: "unauthorized",
		errorCode: options.errorCode,
		definition: options.definition,
		metadata: { reason: "Execution context ownership check failed" },
	});
	return {
		ok: false as const,
		status: 403,
		error: "Tool context unauthorized",
		errorCode: options.errorCode,
		execution,
	};
}

async function authorizeTool(
	definition: ToolDefinition,
	input: unknown,
	context: ToolExecutionContext
) {
	try {
		return {
			ok: true as const,
			authorized: await definition.authorize(input, context),
		};
	} catch (error) {
		logServerError("tools/router", "authorization_failed", error, {
			toolName: definition.name,
		});
		return { ok: false as const };
	}
}

async function runExecution(options: {
	prismaClient: ToolPrismaClient;
	definition: ToolDefinition;
	execution: ToolExecutionRecord;
	parsedInput: unknown;
	context: ToolExecutionContext;
}) {
	const startedAt = options.execution.startedAt ?? now();
	const startedTime = startedAt.getTime();

	try {
		const result = await executeWithTimeout(
			(signal) =>
				options.definition.execute(
					options.parsedInput,
					options.context,
					signal
				),
			options.definition.timeoutMs
		);
		const resultSummary = sanitizeToolResult(
			options.definition.name,
			result
		);
		const completedAt = now();
		const execution = await markExecution(
			options.prismaClient,
			options.execution.id,
			{
				status: "succeeded",
				resultSummaryJson: resultSummary,
				errorCode: null,
				completedAt,
				auditMetadata: auditMetadata({
					maxAttempts: options.definition.maxAttempts,
					timeoutMs: options.definition.timeoutMs,
					durationMs: completedAt.getTime() - startedTime,
				}),
			}
		);

		await recordOperationalMetric({
			kind: "tool_execution",
			source: options.definition.name,
			status: "succeeded",
			durationMs: completedAt.getTime() - startedTime,
			userId: options.context.userId,
			conversationId: options.context.conversationId ?? null,
			traceId: execution.id,
			metadata: {
				riskLevel: options.definition.riskLevel,
				requiresConfirmation: options.definition.requiresConfirmation,
			},
		});

		return { ok: true as const, execution };
	} catch (error) {
		const completedAt = now();
		const timedOut =
			error instanceof Error && error.message === CONTEXT_TIMEOUT_ERROR;
		const controlledError =
			error instanceof ToolExecutionError ? error : null;
		const status: ToolExecutionStatus = timedOut ? "timed_out" : "failed";
		const errorCode = timedOut
			? CONTEXT_TIMEOUT_ERROR
			: (controlledError?.errorCode ?? "TOOL_FAILED");

		logServerError("tools/router", "execution_failed", error, {
			toolName: options.definition.name,
			executionId: options.execution.id,
		});

		const execution = await markExecution(
			options.prismaClient,
			options.execution.id,
			{
				status,
				errorCode,
				completedAt,
				auditMetadata: auditMetadata({
					maxAttempts: options.definition.maxAttempts,
					timeoutMs: options.definition.timeoutMs,
					durationMs: completedAt.getTime() - startedTime,
				}),
			}
		);

		await recordOperationalMetric({
			kind: "tool_execution",
			source: options.definition.name,
			status,
			durationMs: completedAt.getTime() - startedTime,
			errorCode,
			userId: options.context.userId,
			conversationId: options.context.conversationId ?? null,
			traceId: execution.id,
			metadata: {
				riskLevel: options.definition.riskLevel,
				requiresConfirmation: options.definition.requiresConfirmation,
			},
		});

		return {
			ok: false as const,
			status: timedOut ? 504 : (controlledError?.status ?? 500),
			error: timedOut
				? "Tool execution timed out"
				: (controlledError?.message ?? "Tool failed"),
			errorCode,
			execution,
		};
	}
}

export async function proposeToolExecution(
	request: ToolRequestInput,
	options: ToolRouterOptions = {}
): Promise<ToolRouterResult> {
	const prismaClient = options.prismaClient ?? (prisma as any);
	const registry = options.registry ?? defaultToolRegistry;
	const definition = registry.get(request.toolName);
	const contextAuthorization = await authorizeExecutionContext(
		prismaClient,
		request.context
	);
	if (!contextAuthorization.ok) {
		return createUnauthorizedContextAudit({
			prismaClient,
			toolName: request.toolName,
			context: request.context,
			errorCode: contextAuthorization.errorCode,
			definition,
		});
	}

	if (!definition) {
		const execution = await createTerminalAudit({
			prismaClient,
			toolName: request.toolName,
			context: request.context,
			status: "invalid_input",
			errorCode: "UNKNOWN_TOOL",
			metadata: { reason: "No allowlisted definition exists" },
		});
		return {
			ok: false,
			status: 400,
			error: "Unknown tool",
			errorCode: "UNKNOWN_TOOL",
			execution,
		};
	}

	if (!definition.enabled) {
		const execution = await createTerminalAudit({
			prismaClient,
			toolName: request.toolName,
			context: request.context,
			status: "invalid_input",
			errorCode: "TOOL_DISABLED",
			definition,
			metadata: { reason: "Tool is disabled" },
		});
		return {
			ok: false,
			status: 400,
			error: "Tool is disabled",
			errorCode: "TOOL_DISABLED",
			execution,
		};
	}

	const parsed = definition.inputSchema.safeParse(request.input);
	if (!parsed.success) {
		const execution = await createTerminalAudit({
			prismaClient,
			toolName: request.toolName,
			context: request.context,
			status: "invalid_input",
			errorCode: "INVALID_TOOL_INPUT",
			definition,
			metadata: { issueCount: parsed.error.issues.length },
		});
		return {
			ok: false,
			status: 400,
			error: "Invalid tool input",
			errorCode: "INVALID_TOOL_INPUT",
			execution,
		};
	}

	const inputSummary = definition.buildInputSummary(parsed.data);
	const authorization = await authorizeTool(
		definition,
		parsed.data,
		request.context
	);
	if (!authorization.ok) {
		const execution = await createTerminalAudit({
			prismaClient,
			toolName: request.toolName,
			context: request.context,
			status: "failed",
			errorCode: "TOOL_AUTHORIZATION_FAILED",
			inputSummary,
			definition,
			metadata: { reason: "Authorization check failed" },
		});
		return {
			ok: false,
			status: 500,
			error: "Tool authorization failed",
			errorCode: "TOOL_AUTHORIZATION_FAILED",
			execution,
		};
	}
	if (!authorization.authorized) {
		const execution = await createTerminalAudit({
			prismaClient,
			toolName: request.toolName,
			context: request.context,
			status: "unauthorized",
			errorCode: "TOOL_UNAUTHORIZED",
			inputSummary,
			definition,
			metadata: { reason: "Permission check failed" },
		});
		return {
			ok: false,
			status: 403,
			error: "Tool unauthorized",
			errorCode: "TOOL_UNAUTHORIZED",
			execution,
		};
	}

	if (definition.requiresConfirmation) {
		const execution = await toolDelegate(prismaClient).create({
			data: {
				userId: request.context.userId,
				organizationId: request.context.organizationId ?? null,
				conversationId: request.context.conversationId ?? null,
				messageId: request.context.messageId ?? null,
				toolName: definition.name,
				status: "pending_confirmation",
				riskLevel: definition.riskLevel,
				requiresConfirmation: true,
				inputSummaryJson: inputSummary,
				auditMetadata: auditMetadata({
					inputHash: stableToolInputHash(parsed.data),
					maxAttempts: definition.maxAttempts,
					timeoutMs: definition.timeoutMs,
				}),
			},
		});
		return { ok: true, execution };
	}

	const execution = await toolDelegate(prismaClient).create({
		data: {
			userId: request.context.userId,
			organizationId: request.context.organizationId ?? null,
			conversationId: request.context.conversationId ?? null,
			messageId: request.context.messageId ?? null,
			toolName: definition.name,
			status: "running",
			riskLevel: definition.riskLevel,
			requiresConfirmation: false,
			inputSummaryJson: inputSummary,
			startedAt: now(),
			auditMetadata: auditMetadata({
				maxAttempts: definition.maxAttempts,
				timeoutMs: definition.timeoutMs,
			}),
		},
	});

	return runExecution({
		prismaClient,
		definition,
		execution,
		parsedInput: parsed.data,
		context: request.context,
	});
}

function readInputHash(metadata: ToolJsonValue | null) {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}
	const inputHash = (metadata as Record<string, unknown>).inputHash;
	return typeof inputHash === "string" ? inputHash : null;
}

async function transitionPendingExecution(options: {
	prismaClient: ToolPrismaClient;
	executionId: string;
	userId: string;
	data: Record<string, unknown>;
}) {
	const transitioned = await toolDelegate(options.prismaClient).updateMany({
		where: {
			id: options.executionId,
			userId: options.userId,
			status: "pending_confirmation",
		},
		data: options.data,
	});
	if (transitioned.count !== 1) return null;

	return toolDelegate(options.prismaClient).findFirst({
		where: {
			id: options.executionId,
			userId: options.userId,
		},
	});
}

export async function confirmToolExecution(
	request: ConfirmToolInput,
	options: ToolRouterOptions = {}
): Promise<ToolRouterResult> {
	const prismaClient = options.prismaClient ?? (prisma as any);
	const registry = options.registry ?? defaultToolRegistry;
	const existing = await toolDelegate(prismaClient).findFirst({
		where: {
			id: request.executionId,
			userId: request.context.userId,
			status: "pending_confirmation",
		},
	});

	if (!existing) {
		return {
			ok: false,
			status: 404,
			error: "Tool execution not found",
			errorCode: "TOOL_EXECUTION_NOT_FOUND",
			execution: null,
		};
	}

	const startedAt = now();
	const running = await transitionPendingExecution({
		prismaClient,
		executionId: existing.id,
		userId: request.context.userId,
		data: {
			status: "running",
			confirmedAt: startedAt,
			startedAt,
			errorCode: null,
		},
	});
	if (!running) {
		return {
			ok: false,
			status: 409,
			error: "Tool execution is no longer pending confirmation",
			errorCode: "TOOL_EXECUTION_STATE_CONFLICT",
			execution: null,
		};
	}

	const executionContext: ToolExecutionContext = {
		userId: request.context.userId,
		organizationId: existing.organizationId,
		conversationId: existing.conversationId,
		messageId: existing.messageId,
	};
	const contextAuthorization = await authorizeExecutionContext(
		prismaClient,
		executionContext
	);
	if (!contextAuthorization.ok) {
		const execution = await markExecution(prismaClient, existing.id, {
			status: "unauthorized",
			errorCode: contextAuthorization.errorCode,
			completedAt: now(),
		});
		return {
			ok: false,
			status: 403,
			error: "Tool context unauthorized",
			errorCode: contextAuthorization.errorCode,
			execution,
		};
	}

	const definition = registry.get(existing.toolName);
	if (!definition || !definition.enabled) {
		const execution = await markExecution(prismaClient, existing.id, {
			status: "invalid_input",
			errorCode: definition ? "TOOL_DISABLED" : "UNKNOWN_TOOL",
			completedAt: now(),
		});
		return {
			ok: false,
			status: 400,
			error: "Tool cannot be executed",
			errorCode: execution.errorCode ?? "TOOL_UNAVAILABLE",
			execution,
		};
	}

	const parsed = definition.inputSchema.safeParse(request.input);
	if (!parsed.success) {
		const execution = await markExecution(prismaClient, existing.id, {
			status: "invalid_input",
			errorCode: "INVALID_TOOL_INPUT",
			completedAt: now(),
			auditMetadata: auditMetadata({
				issueCount: parsed.error.issues.length,
			}),
		});
		return {
			ok: false,
			status: 400,
			error: "Invalid tool input",
			errorCode: "INVALID_TOOL_INPUT",
			execution,
		};
	}

	if (
		readInputHash(existing.auditMetadata) !==
		stableToolInputHash(parsed.data)
	) {
		const execution = await markExecution(prismaClient, existing.id, {
			status: "invalid_input",
			errorCode: "TOOL_INPUT_MISMATCH",
			completedAt: now(),
		});
		return {
			ok: false,
			status: 409,
			error: "Tool input does not match the pending execution",
			errorCode: "TOOL_INPUT_MISMATCH",
			execution,
		};
	}

	const authorization = await authorizeTool(
		definition,
		parsed.data,
		executionContext
	);
	if (!authorization.ok) {
		const execution = await markExecution(prismaClient, existing.id, {
			status: "failed",
			errorCode: "TOOL_AUTHORIZATION_FAILED",
			completedAt: now(),
		});
		return {
			ok: false,
			status: 500,
			error: "Tool authorization failed",
			errorCode: "TOOL_AUTHORIZATION_FAILED",
			execution,
		};
	}
	if (!authorization.authorized) {
		const execution = await markExecution(prismaClient, existing.id, {
			status: "unauthorized",
			errorCode: "TOOL_UNAUTHORIZED",
			completedAt: now(),
		});
		return {
			ok: false,
			status: 403,
			error: "Tool unauthorized",
			errorCode: "TOOL_UNAUTHORIZED",
			execution,
		};
	}

	return runExecution({
		prismaClient,
		definition,
		execution: running,
		parsedInput: parsed.data,
		context: executionContext,
	});
}

export async function cancelToolExecution(
	request: CancelToolInput,
	options: ToolRouterOptions = {}
): Promise<ToolRouterResult> {
	const prismaClient = options.prismaClient ?? (prisma as any);
	const existing = await toolDelegate(prismaClient).findFirst({
		where: {
			id: request.executionId,
			userId: request.context.userId,
			status: "pending_confirmation",
		},
	});

	if (!existing) {
		return {
			ok: false,
			status: 404,
			error: "Tool execution not found",
			errorCode: "TOOL_EXECUTION_NOT_FOUND",
			execution: null,
		};
	}

	const completedAt = now();
	const execution = await transitionPendingExecution({
		prismaClient,
		executionId: existing.id,
		userId: request.context.userId,
		data: {
			status: "cancelled",
			errorCode: null,
			completedAt,
			auditMetadata: auditMetadata({
				cancelledBy: "user",
				durationMs:
					completedAt.getTime() - existing.createdAt.getTime(),
			}),
		},
	});
	if (!execution) {
		return {
			ok: false,
			status: 409,
			error: "Tool execution is no longer pending confirmation",
			errorCode: "TOOL_EXECUTION_STATE_CONFLICT",
			execution: null,
		};
	}

	logServerWarning("tools/router", "execution_cancelled", {
		toolName: existing.toolName,
		executionId: existing.id,
	});

	return { ok: true, execution };
}
