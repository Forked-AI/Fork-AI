import { runNightlyEvalWorker } from "@/workers/eval.worker";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("eval worker", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("is loaded by the worker entrypoint", () => {
		const source = readFileSync(
			join(process.cwd(), "workers/index.ts"),
			"utf8"
		);

		expect(source).toContain('import "./eval.worker"');
	});

	it("fails live evals with explicit non-networking gates", async () => {
		vi.stubEnv("AI_LIVE_EVAL_DAILY_BUDGET_USD", "0");
		vi.stubEnv("MISTRAL_API_KEY", "");

		await expect(runNightlyEvalWorker({ live: true })).rejects.toThrow(
			"AI_LIVE_EVAL_DAILY_BUDGET_USD must be greater than 0"
		);

		vi.stubEnv("AI_LIVE_EVAL_DAILY_BUDGET_USD", "1");

		await expect(runNightlyEvalWorker({ live: true })).rejects.toThrow(
			"MISTRAL_API_KEY is not configured"
		);

		vi.stubEnv("MISTRAL_API_KEY", "test-key");

		await expect(runNightlyEvalWorker({ live: true })).rejects.toThrow(
			"the live runner is not implemented"
		);
	});
});
