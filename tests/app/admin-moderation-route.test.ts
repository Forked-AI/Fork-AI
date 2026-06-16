import { GET } from "@/app/api/admin/moderation/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	moderationFindMany: vi.fn(),
	moderationCount: vi.fn(),
	abuseFindMany: vi.fn(),
	abuseCount: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		moderationEvent: {
			findMany: mocks.moderationFindMany,
			count: mocks.moderationCount,
		},
		abuseSignal: {
			findMany: mocks.abuseFindMany,
			count: mocks.abuseCount,
		},
	},
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

describe("GET /api/admin/moderation", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.moderationFindMany.mockReset();
		mocks.moderationCount.mockReset();
		mocks.abuseFindMany.mockReset();
		mocks.abuseCount.mockReset();
	});

	it("requires authentication and the admin role", async () => {
		mocks.getSession.mockResolvedValueOnce(null);
		await expect(
			GET(new Request("http://localhost/api/admin/moderation"))
		).resolves.toMatchObject({ status: 401 });

		mocks.getSession.mockResolvedValueOnce({
			user: { id: "user-1", role: "user" },
		});
		await expect(
			GET(new Request("http://localhost/api/admin/moderation"))
		).resolves.toMatchObject({ status: 403 });
	});

	it("returns moderation and abuse metadata without raw content", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.moderationFindMany.mockResolvedValue([
			{
				id: "moderation-1",
				userId: "user-1",
				conversationId: "conversation-1",
				messageId: "message-1",
				fileObjectId: null,
				sharedConversationId: null,
				source: "chat_message",
				stage: "pre_generation",
				category: "prompt_injection",
				action: "review",
				severity: "low",
				policyVersion: "moderation-policy-v1",
				reason: "Prompt-injection language was detected and treated as user data.",
				contentHash: "hash-1",
				contentLength: 42,
				matchedRuleIds: '["prompt-injection-override"]',
				metadataJson: '{"flow":"chat_stream"}',
				createdAt: new Date("2026-06-07T10:00:00.000Z"),
				user: { email: "user@example.com", name: "User" },
			},
		]);
		mocks.abuseFindMany.mockResolvedValue([
			{
				id: "signal-1",
				userId: "user-1",
				conversationId: "conversation-1",
				signalType: "provider_rate_limit",
				severity: "medium",
				action: "degrade",
				actorHash: null,
				count: 1,
				windowSeconds: null,
				provider: "mistral",
				model: "mistral-large-latest",
				providerStatusCode: 429,
				metadataJson: '{"errorCode":"PROVIDER_RATE_LIMITED"}',
				createdAt: new Date("2026-06-07T10:01:00.000Z"),
				user: { email: "user@example.com", name: "User" },
			},
		]);
		mocks.moderationCount.mockResolvedValue(1);
		mocks.abuseCount.mockResolvedValue(1);

		const response = await GET(
			new Request(
				"http://localhost/api/admin/moderation?from=2026-06-01T00%3A00%3A00.000Z&to=2026-06-08T00%3A00%3A00.000Z&category=prompt_injection&action=review&signalType=provider_rate_limit"
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.totals).toEqual({
			moderationEvents: 1,
			abuseSignals: 1,
		});
		expect(payload.events[0]).not.toHaveProperty("content");
		expect(payload.events[0]).not.toHaveProperty("prompt");
		expect(payload.signals[0]).not.toHaveProperty("message");
		expect(mocks.moderationFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					category: "prompt_injection",
					action: "review",
				}),
				take: 25,
			})
		);
		expect(mocks.abuseFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					action: "review",
					signalType: "provider_rate_limit",
				}),
				take: 25,
			})
		);
	});
});
