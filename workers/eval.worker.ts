import { runEvalSuite } from "@/lib/ai/evals/runner";

export async function runNightlyEvalWorker(options: {
	datasetPath?: string;
	baselinePath?: string;
	live?: boolean;
}) {
	if (options.live !== true) {
		return runEvalSuite({
			datasetPaths: [options.datasetPath ?? "evals/datasets"],
			baselinePath: options.baselinePath,
			live: false,
		});
	}

	const budget = Number(process.env.AI_LIVE_EVAL_DAILY_BUDGET_USD ?? "0");
	if (budget <= 0) {
		throw new Error("Live eval budget is not configured");
	}

	return runEvalSuite({
		datasetPaths: [options.datasetPath ?? "evals/datasets"],
		baselinePath: options.baselinePath,
		live: true,
	});
}
