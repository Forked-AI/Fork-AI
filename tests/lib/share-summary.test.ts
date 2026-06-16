import { generateShareSummary } from "@/lib/share/summary";
import { describe, expect, it, vi } from "vitest";

function createPrismaMock() {
	let outcome = "pending";
	const prismaClient: any = {
		usageEvent: {
			create: vi.fn(async () => ({ id: "usage-1" })),
			findUnique: vi.fn(async () => ({
				id: "usage-1",
				userId: "user-1",
				outcome,
			})),
			updateMany: vi.fn(async () => {
				if (outcome !== "pending") return { count: 0 };
				outcome = "completed";
				return { count: 1 };
			}),
		},
		quotaLedger: { upsert: vi.fn(async () => ({ id: "quota-1" })) },
	};
	prismaClient.$transaction = vi.fn(async (callback) =>
		callback(prismaClient)
	);
	return prismaClient;
}

describe("share summary usage", () => {
	it("meters provider-backed share summaries without persisting prompt content", async () => {
		const prismaClient = createPrismaMock();
		const provider = {
			complete: vi.fn(async () => ({
				content:
					'{"overview":"A concise overview","keyPoints":["One","Two"]}',
				usage: { promptTokens: 20, completionTokens: 8 },
				providerRequestId: "completion-1",
				resolvedModel: "ministral-3b-2512",
			})),
			stream: vi.fn(),
		};

		await expect(
			generateShareSummary({
				userId: "user-1",
				conversationId: "conversation-1",
				messages: [{ role: "user", content: "Private prompt text" }],
				enabled: true,
				provider,
				prismaClient,
			})
		).resolves.toMatchObject({
			summary: {
				overview: "A concise overview",
				model: "ministral-3b-2512",
			},
			warning: null,
		});

		const createData = prismaClient.usageEvent.create.mock.calls[0][0].data;
		expect(createData).toMatchObject({
			userId: "user-1",
			conversationId: "conversation-1",
			feature: "conversation_summary",
			promptVersion: "share-summary-v1",
		});
		expect(JSON.stringify(createData)).not.toContain("Private prompt text");
		expect(prismaClient.usageEvent.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					inputTokens: 20,
					outputTokens: 8,
					providerRequestId: "completion-1",
				}),
			})
		);
		expect(prismaClient.quotaLedger.upsert).toHaveBeenCalledTimes(1);
	});
});
