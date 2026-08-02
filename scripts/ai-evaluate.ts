import { runEvalSuite } from "@/lib/ai/evals/runner";
import { pathToFileURL } from "node:url";

function readOption(name: string, argv = process.argv.slice(2)) {
	const prefix = `--${name}=`;
	return argv
		.find((argument) => argument.startsWith(prefix))
		?.slice(prefix.length);
}

function readRepeatedOption(name: string, argv = process.argv.slice(2)) {
	const prefix = `--${name}=`;
	return argv
		.filter((argument) => argument.startsWith(prefix))
		.map((argument) => argument.slice(prefix.length));
}

export async function runAiEvaluateCli({
	argv = process.argv.slice(2),
	stdout = process.stdout,
	stderr = process.stderr,
}: {
	argv?: string[];
	stdout?: Pick<NodeJS.WriteStream, "write">;
	stderr?: Pick<NodeJS.WriteStream, "write">;
} = {}) {
	const datasetPaths = readRepeatedOption("dataset", argv);
	const baselinePath = readOption("baseline", argv);
	const outputPath = readOption("output", argv);
	const live = argv.includes("--live");

	const result = await runEvalSuite({
		datasetPaths:
			datasetPaths.length > 0 ? datasetPaths : ["evals/datasets"],
		baselinePath: baselinePath ?? "evals/baselines/ci-smoke.v2.json",
		outputPath,
		live,
	});

	stdout.write(
		[
			`AI eval suite: ${result.summary.passedCases}/${result.summary.totalCases} passed`,
			`passRate=${result.summary.passRate}`,
			`score=${result.summary.score}`,
			result.summary.rag
				? `rag.recallAt4=${result.summary.rag.recallAt4} rag.contextPrecision=${result.summary.rag.contextPrecision} rag.hardNegativeRejection=${result.summary.rag.hardNegativeRejection}`
				: "",
		]
			.filter(Boolean)
			.join(" ") + "\n"
	);

	if (result.failures.length > 0) {
		for (const failure of result.failures) {
			stderr.write(
				[
					`[${failure.caseId}] ${failure.datasetPath}`,
					...failure.reasons.map((reason) => `- ${reason}`),
				].join("\n") + "\n"
			);
		}
		return 1;
	}

	return 0;
}

async function main() {
	try {
		process.exitCode = await runAiEvaluateCli();
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
		);
		process.exitCode = 1;
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	void main();
}
