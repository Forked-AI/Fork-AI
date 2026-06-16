import { describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => ({
	Worker: vi.fn(function Worker(name, processor, options) {
		return {
			name,
			processor,
			options,
			on: vi.fn(),
		};
	}),
	generateConversationSummary: vi.fn(),
	generateConversationTitle: vi.fn(),
}));

vi.mock("bullmq", () => ({
	Worker: workerMocks.Worker,
}));

vi.mock("@/lib/queue/connection", () => ({
	queueConnection: { host: "redis.test" },
}));

vi.mock("@/lib/conversations/generate-summary", () => ({
	generateConversationSummary: workerMocks.generateConversationSummary,
}));

vi.mock("@/lib/conversations/generate-title", () => ({
	generateConversationTitle: workerMocks.generateConversationTitle,
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
}));

describe("conversation worker", () => {
	it("dispatches summarize-conversation jobs to the summary generator", async () => {
		workerMocks.generateConversationSummary.mockResolvedValue({
			id: "summary-1",
			conversationId: "conversation-1",
			promptVersion: "chat-context-v1",
			sourceMessageCount: 12,
		});

		await import("../../workers/conversation.worker");
		const processor = workerMocks.Worker.mock.calls[0][1] as (_job: {
			id: string;
			name: string;
			data: { conversationId: string; userId: string };
		}) => Promise<void>;

		await processor({
			id: "job-1",
			name: "summarize-conversation",
			data: {
				conversationId: "conversation-1",
				userId: "user-1",
			},
		});

		expect(workerMocks.generateConversationSummary).toHaveBeenCalledWith({
			conversationId: "conversation-1",
			userId: "user-1",
		});
	});
});
