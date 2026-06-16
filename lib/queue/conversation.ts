import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export type ConversationQueueJobName =
	| "generate-title"
	| "summarize-conversation";

export interface GenerateTitleJobData {
	conversationId: string;
	userId: string;
}

export interface SummarizeConversationJobData {
	conversationId: string;
	userId: string;
}

export type ConversationQueueJobData =
	| GenerateTitleJobData
	| SummarizeConversationJobData;

export const conversationQueue = new Queue<
	ConversationQueueJobData,
	void,
	ConversationQueueJobName
>("conversation", {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 1000,
		},
		removeOnComplete: 100,
		removeOnFail: 500,
	},
});

export function enqueueConversationSummaryJob(
	options: SummarizeConversationJobData
) {
	return conversationQueue.add("summarize-conversation", options, {
		jobId: `summarize-conversation:${options.userId}:${options.conversationId}`,
	});
}
