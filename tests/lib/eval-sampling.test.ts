import { shouldSampleForShadowEval } from "@/lib/ai/eval-sampling";
import { planShadowRun } from "@/lib/ai/shadow-runs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recordOperationalMetric = vi.fn();

vi.mock("@/lib/operational-metrics", () => ({
	recordOperationalMetric: (...args: unknown[]) =>
		recordOperationalMetric(...args),
}));

describe("AI eval sampling and shadow runs", () => {
	beforeEach(() => {
		recordOperationalMetric.mockReset();
	});

	it("does not sample when disabled or budget is unavailable", () => {
		expect(
			shouldSampleForShadowEval({
				requestId: "request-1",
				userId: "user-1",
				taskId: "chat.general",
				promptLength: 100,
				policy: {
					enabled: false,
					rate: 1,
					maxPromptChars: 1_000,
					allowedTasks: ["chat.general"],
					liveProviderBudgetUsd: 10,
				},
			})
		).toMatchObject({ sample: false, reason: "disabled" });

		expect(
			shouldSampleForShadowEval({
				requestId: "request-1",
				userId: "user-1",
				taskId: "chat.general",
				promptLength: 100,
				policy: {
					enabled: true,
					rate: 1,
					maxPromptChars: 1_000,
					allowedTasks: ["chat.general"],
					liveProviderBudgetUsd: 0,
				},
			})
		).toMatchObject({ sample: false, reason: "budget_unavailable" });
	});

	it("plans side-effect-free shadow runs with privacy-safe metadata", async () => {
		const result = await planShadowRun({
			requestId: "request-1",
			userId: "user-1",
			taskId: "chat.general",
			promptLength: 120,
			model: "mistral-small-latest",
			provider: "mistral",
			policy: {
				enabled: true,
				rate: 1,
				maxPromptChars: 1_000,
				allowedTasks: ["chat.general"],
				liveProviderBudgetUsd: 10,
			},
		});

		expect(result).toMatchObject({
			sample: true,
			sideEffectFree: true,
		});
		expect(recordOperationalMetric).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "ai_shadow_run",
				status: "planned",
				metadata: expect.objectContaining({
					sideEffectFree: true,
					promptLength: 120,
				}),
			})
		);
	});
});
