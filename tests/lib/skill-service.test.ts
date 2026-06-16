import { installSkill, upgradeInstalledSkill } from "@/lib/skills/service";
import { describe, expect, it, vi } from "vitest";

function installedRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "installed-1",
		userId: "user-1",
		templateId: "technical-prd-writer",
		versionId: "v1",
		alias: null,
		enabled: true,
		pinned: false,
		defaultScope: null,
		settingsJson: null,
		installedAt: new Date("2026-06-14T00:00:00.000Z"),
		lastUsedAt: null,
		disabledAt: null,
		...overrides,
	};
}

describe("skill service mutation behavior", () => {
	it("recovers from concurrent duplicate installs without creating two rows", async () => {
		const concurrentRow = installedRow();
		const findFirst = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(concurrentRow);
		const update = vi.fn().mockResolvedValue(concurrentRow);
		const prismaClient = {
			installedSkill: {
				findFirst,
				create: vi.fn().mockRejectedValue({ code: "P2002" }),
				update,
			},
			skillCollection: {
				upsert: vi.fn().mockResolvedValue({ id: "collection-default" }),
			},
			skillCollectionItem: {
				upsert: vi.fn().mockResolvedValue({ id: "item-1" }),
			},
		};

		const result = await installSkill({
			userId: "user-1",
			templateId: "technical-prd-writer",
			versionId: "v1",
			prismaClient: prismaClient as never,
		});

		expect(result?.id).toBe("installed-1");
		expect(prismaClient.installedSkill.create).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith({
			where: { id: "installed-1" },
			data: { enabled: true, disabledAt: null },
		});
		expect(prismaClient.skillCollectionItem.upsert).toHaveBeenCalledTimes(
			1
		);
	});

	it("upgrades an installed private skill and refreshes active bindings", async () => {
		const existing = installedRow({
			templateId: "template-1",
			versionId: "version-1",
		});
		const upgraded = {
			...existing,
			versionId: "version-2",
		};
		const currentVersion = {
			id: "version-2",
			templateId: "template-1",
			version: 2,
			manifestJson: {
				whenToUse: "Use this skill for structured product planning.",
				instructions:
					"Turn requests into scoped requirements and acceptance criteria.",
				outputFormat: "Use headings and checklists.",
				examples: [],
				settings: {},
			},
			riskLevel: "low",
			requiredTools: [],
			template: {
				id: "template-1",
				title: "Private Planner",
				summary: "Creates implementation-ready plans.",
				description:
					"Creates implementation-ready product and engineering plans.",
				category: "personal",
				tags: [],
				ownerId: "user-1",
				visibility: "private",
				status: "draft",
				currentVersionId: "version-2",
			},
		};
		const bindingUpdate = vi.fn().mockResolvedValue({ count: 1 });
		const installUpdate = vi.fn().mockResolvedValue(upgraded);
		const transactionClient = {
			installedSkill: {
				findFirst: vi.fn().mockResolvedValue(null),
				update: installUpdate,
			},
			conversationSkillBinding: {
				updateMany: bindingUpdate,
			},
		};
		const prismaClient = {
			installedSkill: {
				findFirst: vi.fn().mockResolvedValue(existing),
			},
			skillTemplateVersion: {
				findFirst: vi.fn().mockResolvedValue(currentVersion),
			},
			$transaction: vi.fn(
				async (
					handler: (_client: typeof transactionClient) => unknown
				) => handler(transactionClient)
			),
		};

		const result = await upgradeInstalledSkill({
			userId: "user-1",
			installedSkillId: "installed-1",
			prismaClient: prismaClient as never,
		});

		expect(result?.versionId).toBe("version-2");
		expect(result?.updateAvailable).toBe(false);
		expect(installUpdate).toHaveBeenCalledWith({
			where: { id: "installed-1" },
			data: { versionId: "version-2" },
		});
		expect(bindingUpdate).toHaveBeenCalledWith({
			where: { installedSkillId: "installed-1", consumedAt: null },
			data: {
				versionId: "version-2",
				renderHash: null,
			},
		});
	});
});
