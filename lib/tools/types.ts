import type { z } from "zod";

export type ToolRiskLevel = "low" | "medium" | "high";

export type ToolExecutionStatus =
	| "pending_confirmation"
	| "cancelled"
	| "running"
	| "succeeded"
	| "failed"
	| "unauthorized"
	| "invalid_input"
	| "timed_out";

export type ToolJsonPrimitive = string | number | boolean | null;
export type ToolJsonValue =
	| ToolJsonPrimitive
	| ToolJsonValue[]
	| { [key: string]: ToolJsonValue };

export interface ToolExecutionRecord {
	id: string;
	userId: string;
	organizationId: string | null;
	conversationId: string | null;
	messageId: string | null;
	toolName: string;
	status: ToolExecutionStatus;
	riskLevel: ToolRiskLevel;
	requiresConfirmation: boolean;
	confirmedAt: Date | null;
	inputSummaryJson: ToolJsonValue | null;
	resultSummaryJson: ToolJsonValue | null;
	auditMetadata: ToolJsonValue | null;
	errorCode: string | null;
	startedAt: Date | null;
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface ToolExecutionContext {
	userId: string;
	organizationId?: string | null;
	conversationId?: string | null;
	messageId?: string | null;
}

export interface ToolResult {
	displayText: string;
	metadata?: Record<string, unknown>;
}

export interface ToolDefinition<TInput = unknown> {
	name: string;
	description: string;
	riskLevel: ToolRiskLevel;
	enabled: boolean;
	requiresConfirmation: boolean;
	timeoutMs: number;
	maxAttempts: number;
	inputSchema: z.ZodType<TInput>;
	buildInputSummary(_input: TInput): ToolJsonValue;
	authorize(_input: TInput, _context: ToolExecutionContext): Promise<boolean>;
	execute(
		_input: TInput,
		_context: ToolExecutionContext,
		_signal: AbortSignal
	): Promise<ToolResult>;
}

export interface ToolRegistry {
	get(_name: string): ToolDefinition | null;
	list(): ToolDefinition[];
}

export interface ToolExecutionDelegate {
	create(_args: {
		data: Record<string, unknown>;
	}): Promise<ToolExecutionRecord>;
	findFirst(
		_args: Record<string, unknown>
	): Promise<ToolExecutionRecord | null>;
	findMany(_args: Record<string, unknown>): Promise<ToolExecutionRecord[]>;
	count(_args: Record<string, unknown>): Promise<number>;
	update(_args: {
		where: { id: string };
		data: Record<string, unknown>;
	}): Promise<ToolExecutionRecord>;
	updateMany(_args: {
		where: Record<string, unknown>;
		data: Record<string, unknown>;
	}): Promise<{ count: number }>;
}

export interface ToolPrismaClient {
	toolExecution: ToolExecutionDelegate;
	conversation: {
		findFirst(
			_args: Record<string, unknown>
		): Promise<{ id: string } | null>;
	};
	message: {
		findFirst(
			_args: Record<string, unknown>
		): Promise<{ id: string; conversationId: string } | null>;
	};
}
