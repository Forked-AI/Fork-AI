import type {
	AccountExportFile,
	AccountExportFormat,
} from "@/lib/account-export";
import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export type AccountExportQueueJobName = "generate-account-export";

export interface GenerateAccountExportJobData {
	userId: string;
	format: AccountExportFormat;
}

export type AccountExportQueueJobData = GenerateAccountExportJobData;
export type AccountExportQueueJobResult = AccountExportFile;

export const accountExportQueue = new Queue<
	AccountExportQueueJobData,
	AccountExportQueueJobResult,
	AccountExportQueueJobName
>("account-export", {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 2,
		backoff: {
			type: "exponential",
			delay: 1000,
		},
		removeOnComplete: {
			age: 60 * 60,
			count: 100,
		},
		removeOnFail: 500,
	},
});

export async function enqueueAccountExportJob(options: {
	userId: string;
	format: AccountExportFormat;
}) {
	return accountExportQueue.add("generate-account-export", options, {
		jobId: `account-export:${options.userId}:${options.format}:${Date.now()}`,
	});
}
