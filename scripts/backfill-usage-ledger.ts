import { prisma } from "../lib/prisma";
import { backfillUsageLedger } from "../lib/usage/backfill";

function readBatchSize() {
	const argument = process.argv.find((value) =>
		value.startsWith("--batch-size=")
	);
	const parsed = Number.parseInt(argument?.split("=")[1] ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function readStaleTimeoutMs() {
	const argument = process.argv.find((value) =>
		value.startsWith("--stale-minutes=")
	);
	const minutes = Number.parseInt(argument?.split("=")[1] ?? "", 10);
	return Number.isFinite(minutes) && minutes > 0
		? minutes * 60 * 1000
		: undefined;
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");
	const result = await backfillUsageLedger({
		dryRun,
		batchSize: readBatchSize(),
		staleTimeoutMs: readStaleTimeoutMs(),
	});

	process.stdout.write(
		`${dryRun ? "Dry run" : "Backfill complete"}: ${JSON.stringify(result)}\n`
	);
}

main()
	.catch((error) => {
		process.stderr.write(
			`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
