import { GET } from "@/app/api/admin/provider-health/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

describe("GET /api/admin/provider-health", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		delete process.env.AI_MODEL_ROLLOUT_OVERRIDES;
	});

	it("requires authentication and the admin role", async () => {
		mocks.getSession.mockResolvedValueOnce(null);
		await expect(
			GET(new Request("http://localhost/api/admin/provider-health"))
		).resolves.toMatchObject({ status: 401 });

		mocks.getSession.mockResolvedValueOnce({
			user: { id: "user-1", role: "user" },
		});
		await expect(
			GET(new Request("http://localhost/api/admin/provider-health"))
		).resolves.toMatchObject({ status: 403 });
	});

	it("returns provider rollout metadata without private provider payloads", async () => {
		process.env.AI_MODEL_ROLLOUT_OVERRIDES = "gpt-5.1=canary";
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});

		const response = await GET(
			new Request("http://localhost/api/admin/provider-health")
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.providers.openai).toMatchObject({
			textGeneration: true,
			streaming: true,
			structuredOutput: true,
		});
		expect(payload.models).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					provider: "openai",
					model: "gpt-5.1",
					rolloutState: "canary",
					evalReportPath:
						"evals/reports/phase3-openai-offline-contract.json",
					rollbackEnv: "AI_MODEL_ROLLOUT_OVERRIDES",
					rollbackValue: "gpt-5.1=disabled",
				}),
			])
		);
		expect(JSON.stringify(payload)).not.toContain("apiKey");
		expect(JSON.stringify(payload)).not.toContain("rawResponse");
	});
});
