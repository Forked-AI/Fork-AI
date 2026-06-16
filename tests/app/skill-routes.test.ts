import { POST as bindSkill } from "@/app/api/conversations/[id]/skills/route";
import { POST as createCollectionItem } from "@/app/api/skills/collections/[id]/items/route";
import { POST as createCollection } from "@/app/api/skills/collections/route";
import {
	DELETE as deleteInstall,
	PATCH as updateInstall,
} from "@/app/api/skills/installed/[id]/route";
import { POST as upgradeInstall } from "@/app/api/skills/installed/[id]/upgrade/route";
import { POST as installSkill } from "@/app/api/skills/installed/route";
import { POST as createTemplate } from "@/app/api/skills/templates/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	checkRateLimit: vi.fn(),
	withJsonIdempotency: vi.fn(),
	createCustomSkillTemplate: vi.fn(),
	installSkill: vi.fn(),
	updateInstalledSkill: vi.fn(),
	deleteInstalledSkill: vi.fn(),
	upgradeInstalledSkill: vi.fn(),
	createSkillCollection: vi.fn(),
	addSkillToCollection: vi.fn(),
	bindConversationSkill: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/idempotency", () => ({
	getUserIdempotencyActorKey: (userId: string) => `user:${userId}`,
	withJsonIdempotency: mocks.withJsonIdempotency,
}));

vi.mock("@/lib/skills/http", () => ({
	checkSkillMutationRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/skills/service", () => ({
	listInstalledSkills: vi.fn(),
	listSkillCollections: vi.fn(),
	listConversationSkills: vi.fn(),
	listSkillTemplates: vi.fn(),
	createCustomSkillTemplate: mocks.createCustomSkillTemplate,
	installSkill: mocks.installSkill,
	updateInstalledSkill: mocks.updateInstalledSkill,
	deleteInstalledSkill: mocks.deleteInstalledSkill,
	upgradeInstalledSkill: mocks.upgradeInstalledSkill,
	createSkillCollection: mocks.createSkillCollection,
	addSkillToCollection: mocks.addSkillToCollection,
	bindConversationSkill: mocks.bindConversationSkill,
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

function jsonRequest(url: string, method: string, body?: unknown) {
	return new Request(url, {
		method,
		headers: {
			"Content-Type": "application/json",
			"Idempotency-Key": `test-${method.toLowerCase()}`,
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

describe("skill API routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.checkRateLimit.mockResolvedValue({ allowed: true });
		mocks.withJsonIdempotency.mockImplementation(
			async (_request, _options, handler) => {
				const result = await handler();
				return Response.json(result.body, {
					status: result.status ?? 200,
				});
			}
		);
	});

	it("requires authentication before skill mutations", async () => {
		mocks.getSession.mockResolvedValue(null);

		const response = await installSkill(
			jsonRequest("http://localhost/api/skills/installed", "POST", {
				templateId: "template-1",
			})
		);

		expect(response.status).toBe(401);
		expect(mocks.checkRateLimit).not.toHaveBeenCalled();
		expect(mocks.installSkill).not.toHaveBeenCalled();
	});

	it("validates bounded custom skill input before creation", async () => {
		const response = await createTemplate(
			jsonRequest("http://localhost/api/skills/templates", "POST", {
				name: "No",
			})
		);

		expect(response.status).toBe(400);
		expect(mocks.withJsonIdempotency).not.toHaveBeenCalled();
		expect(mocks.createCustomSkillTemplate).not.toHaveBeenCalled();
	});

	it("installs through rate limiting and user-scoped idempotency", async () => {
		mocks.installSkill.mockResolvedValue({
			id: "installed-1",
			templateId: "template-1",
			versionId: "version-1",
		});

		const response = await installSkill(
			jsonRequest("http://localhost/api/skills/installed", "POST", {
				templateId: "template-1",
				versionId: "version-1",
			})
		);

		expect(response.status).toBe(201);
		expect(mocks.checkRateLimit).toHaveBeenCalledWith(
			expect.any(Request),
			"user-1",
			"install"
		);
		expect(mocks.withJsonIdempotency).toHaveBeenCalledWith(
			expect.any(Request),
			expect.objectContaining({
				scope: "skills:install",
				actorKey: "user:user-1",
			}),
			expect.any(Function)
		);
		expect(mocks.installSkill).toHaveBeenCalledWith({
			userId: "user-1",
			templateId: "template-1",
			versionId: "version-1",
		});
	});

	it("preserves ownership boundaries when updating and deleting installs", async () => {
		mocks.updateInstalledSkill.mockResolvedValue(null);
		mocks.deleteInstalledSkill.mockResolvedValue(false);

		const updateResponse = await updateInstall(
			jsonRequest(
				"http://localhost/api/skills/installed/installed-other",
				"PATCH",
				{ pinned: true }
			),
			{ params: Promise.resolve({ id: "installed-other" }) }
		);
		const deleteResponse = await deleteInstall(
			jsonRequest(
				"http://localhost/api/skills/installed/installed-other",
				"DELETE"
			),
			{ params: Promise.resolve({ id: "installed-other" }) }
		);

		expect(updateResponse.status).toBe(404);
		expect(deleteResponse.status).toBe(404);
		expect(mocks.updateInstalledSkill).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				installedSkillId: "installed-other",
			})
		);
		expect(mocks.deleteInstalledSkill).toHaveBeenCalledWith({
			userId: "user-1",
			installedSkillId: "installed-other",
		});
	});

	it("blocks mutations when the skill write rate limit is exhausted", async () => {
		mocks.checkRateLimit.mockResolvedValue({
			allowed: false,
			response: Response.json(
				{ error: "Too many requests" },
				{ status: 429 }
			),
		});

		const response = await createCollection(
			jsonRequest("http://localhost/api/skills/collections", "POST", {
				name: "Research",
			})
		);

		expect(response.status).toBe(429);
		expect(mocks.createSkillCollection).not.toHaveBeenCalled();
	});

	it("updates versions, collection membership, and chat bindings as the session user", async () => {
		mocks.upgradeInstalledSkill.mockResolvedValue({ id: "installed-1" });
		mocks.addSkillToCollection.mockResolvedValue({ id: "item-1" });
		mocks.bindConversationSkill.mockResolvedValue({ id: "binding-1" });

		const upgradeResponse = await upgradeInstall(
			jsonRequest(
				"http://localhost/api/skills/installed/installed-1/upgrade",
				"POST"
			),
			{ params: Promise.resolve({ id: "installed-1" }) }
		);
		const collectionResponse = await createCollectionItem(
			jsonRequest(
				"http://localhost/api/skills/collections/collection-1/items",
				"POST",
				{ installedSkillId: "installed-1" }
			),
			{ params: Promise.resolve({ id: "collection-1" }) }
		);
		const bindingResponse = await bindSkill(
			jsonRequest(
				"http://localhost/api/conversations/conversation-1/skills",
				"POST",
				{ installedSkillId: "installed-1" }
			),
			{ params: Promise.resolve({ id: "conversation-1" }) }
		);

		expect(upgradeResponse.status).toBe(200);
		expect(collectionResponse.status).toBe(201);
		expect(bindingResponse.status).toBe(201);
		expect(mocks.upgradeInstalledSkill).toHaveBeenCalledWith({
			userId: "user-1",
			installedSkillId: "installed-1",
		});
		expect(mocks.addSkillToCollection).toHaveBeenCalledWith({
			userId: "user-1",
			collectionId: "collection-1",
			installedSkillId: "installed-1",
		});
		expect(mocks.bindConversationSkill).toHaveBeenCalledWith({
			userId: "user-1",
			conversationId: "conversation-1",
			installedSkillId: "installed-1",
		});
	});
});
