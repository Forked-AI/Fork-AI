import { z } from "zod";
import { defaultToolRegistry } from "@/lib/tools/registry";
import { proposeToolExecution } from "@/lib/tools/router";
import type {
	ToolExecutionContext,
	ToolExecutionRecord,
	ToolRegistry,
} from "@/lib/tools/types";

export const TOOL_PLANNER_VERSION = "tool-planner-v1";

export const toolPlanStepSchema = z.object({
	toolName: z.string().trim().min(1).max(120),
	input: z.unknown(),
	reason: z.string().trim().max(500).default(""),
	requiresConfirmation: z.boolean().default(false),
});

export const toolPlanSchema = z.object({
	steps: z.array(toolPlanStepSchema).max(5),
	finalAnswerInstruction: z.string().trim().max(1_000).default(""),
});

export type ToolPlan = z.infer<typeof toolPlanSchema>;

export interface ToolPlannerBudget {
	maxToolCalls: number;
	maxWallClockMs: number;
	maxProviderCalls: number;
	maxResultTokens: number;
	maxCostUsd: number;
}

export const defaultToolPlannerBudget: ToolPlannerBudget = {
	maxToolCalls: Number(process.env.AI_TOOL_PLAN_MAX_CALLS ?? "3"),
	maxWallClockMs: Number(
		process.env.AI_TOOL_PLAN_MAX_WALL_CLOCK_MS ?? "15000"
	),
	maxProviderCalls: Number(
		process.env.AI_TOOL_PLAN_MAX_PROVIDER_CALLS ?? "1"
	),
	maxResultTokens: Number(
		process.env.AI_TOOL_PLAN_MAX_RESULT_TOKENS ?? "2000"
	),
	maxCostUsd: Number(process.env.AI_TOOL_PLAN_MAX_COST_USD ?? "0.02"),
};

export function validateToolPlan(
	plan: unknown,
	options: {
		registry?: ToolRegistry;
		budget?: ToolPlannerBudget;
		allowParallelReadOnly?: boolean;
	} = {}
) {
	const registry = options.registry ?? defaultToolRegistry;
	const budget = options.budget ?? defaultToolPlannerBudget;
	const parsed = toolPlanSchema.safeParse(plan);
	if (!parsed.success) {
		return {
			ok: false as const,
			errorCode: "TOOL_PLAN_SCHEMA_INVALID",
			issues: parsed.error.issues,
		};
	}
	if (parsed.data.steps.length > budget.maxToolCalls) {
		return {
			ok: false as const,
			errorCode: "TOOL_PLAN_BUDGET_EXCEEDED",
			issues: [],
		};
	}

	for (const step of parsed.data.steps) {
		const definition = registry.get(step.toolName);
		if (!definition || !definition.enabled) {
			return {
				ok: false as const,
				errorCode: "TOOL_PLAN_UNKNOWN_TOOL",
				issues: [],
			};
		}
		if (definition.riskLevel !== "low" && !step.requiresConfirmation) {
			return {
				ok: false as const,
				errorCode: "TOOL_PLAN_CONFIRMATION_REQUIRED",
				issues: [],
			};
		}
	}

	return { ok: true as const, plan: parsed.data };
}

export async function executeBoundedToolPlan(input: {
	plan: unknown;
	context: ToolExecutionContext;
	registry?: ToolRegistry;
	budget?: ToolPlannerBudget;
}) {
	const startedAt = Date.now();
	const registry = input.registry ?? defaultToolRegistry;
	const budget = input.budget ?? defaultToolPlannerBudget;
	const validation = validateToolPlan(input.plan, {
		registry,
		budget,
	});
	if (!validation.ok) return validation;

	const executeStep = async (step: ToolPlan["steps"][number]) => {
		return proposeToolExecution(
			{
				toolName: step.toolName,
				input: step.input,
				context: input.context,
			},
			{ registry }
		);
	};
	const allLowRisk = validation.plan.steps.every(
		(step) => registry.get(step.toolName)?.riskLevel === "low"
	);
	const executions: ToolExecutionRecord[] = [];

	if (allLowRisk) {
		const results = await Promise.all(
			validation.plan.steps.map(executeStep)
		);
		for (const result of results) {
			if (result.execution) executions.push(result.execution);
			if (!result.ok) {
				return {
					ok: false as const,
					errorCode: result.errorCode,
					executions,
				};
			}
		}
	} else {
		for (const step of validation.plan.steps) {
			if (Date.now() - startedAt > budget.maxWallClockMs) {
				return {
					ok: false as const,
					errorCode: "TOOL_PLAN_TIMEOUT",
					executions,
				};
			}

			const result = await executeStep(step);
			if (result.execution) executions.push(result.execution);
			if (!result.ok) {
				return {
					ok: false as const,
					errorCode: result.errorCode,
					executions,
				};
			}
		}
	}

	return {
		ok: true as const,
		executions,
		policyVersion: TOOL_PLANNER_VERSION,
	};
}
