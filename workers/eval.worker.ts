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
		throw new Error(
			"Live provider evals are unavailable: AI_LIVE_EVAL_DAILY_BUDGET_USD must be greater than 0."
		);
	}

	if (!process.env.MISTRAL_API_KEY?.trim()) {
		throw new Error(
			"Live provider evals are unavailable: MISTRAL_API_KEY is not configured."
		);
	}

	throw new Error(
		"Live provider evals are unavailable: the live runner is not implemented; offline evals remain the only non-networking gate."
	);
}
