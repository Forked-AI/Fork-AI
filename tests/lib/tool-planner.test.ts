import {
	executeBoundedToolPlan,
	validateToolPlan,
} from "@/lib/ai/tool-planner";
import type { ToolDefinition } from "@/lib/tools/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const proposeToolExecution = vi.fn();

vi.mock("@/lib/tools/router", () => ({
	proposeToolExecution: (...args: unknown[]) => proposeToolExecution(...args),
}));

const lowRiskTool: ToolDefinition<{ query: string }> = {
	name: "rag.retrieve_context",
	description: "Retrieve context",
	riskLevel: "low",
	enabled: true,
	requiresConfirmation: false,
	timeoutMs: 1000,
	maxAttempts: 1,
	inputSchema: z.object({ query: z.string().min(1) }),
	buildInputSummary: () => ({}),
	authorize: async () => true,
	execute: async () => ({ displayText: "ok" }),
};

const mediumRiskTool: ToolDefinition<{ title: string }> = {
	name: "conversation.rename",
	description: "Rename",
	riskLevel: "medium",
	enabled: true,
	requiresConfirmation: true,
	timeoutMs: 1000,
	maxAttempts: 1,
	inputSchema: z.object({ title: z.string().min(1) }),
	buildInputSummary: (input) => ({ titleLength: input.title.length }),
	authorize: async () => true,
	execute: async () => ({ displayText: "renamed" }),
};

const registry = {
	get(name: string) {
		return (
			[lowRiskTool, mediumRiskTool].find((tool) => tool.name === name) ??
			null
		);
	},
	list() {
		return [lowRiskTool, mediumRiskTool];
	},
};

describe("tool planner", () => {
	beforeEach(() => {
		proposeToolExecution.mockReset();
	});

	it("rejects unknown tools and unconfirmed medium-risk steps", () => {
		expect(
			validateToolPlan(
				{ steps: [{ toolName: "shell.exec", input: {} }] },
				{ registry }
			)
		).toMatchObject({ ok: false, errorCode: "TOOL_PLAN_UNKNOWN_TOOL" });

		expect(
			validateToolPlan(
				{
					steps: [
						{
							toolName: "conversation.rename",
							input: { title: "New" },
						},
					],
				},
				{ registry }
			)
		).toMatchObject({
			ok: false,
			errorCode: "TOOL_PLAN_CONFIRMATION_REQUIRED",
		});
	});

	it("executes bounded low-risk plans through the audited router", async () => {
		proposeToolExecution.mockResolvedValue({
			ok: true,
			execution: { id: "tool-exec-1" },
		});

		const result = await executeBoundedToolPlan({
			plan: {
				steps: [
					{
						toolName: "rag.retrieve_context",
						input: { query: "refund policy" },
					},
				],
			},
			context: { userId: "user-1" },
			registry,
		});

		expect(result).toMatchObject({ ok: true });
		expect(proposeToolExecution).toHaveBeenCalledWith(
			{
				toolName: "rag.retrieve_context",
				input: { query: "refund policy" },
				context: { userId: "user-1" },
			},
			{ registry }
		);
	});
});
