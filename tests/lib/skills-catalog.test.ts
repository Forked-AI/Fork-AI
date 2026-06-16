import {
	FIRST_PARTY_SKILL_TEMPLATES,
	createSkillTemplateSchema,
	getFirstPartySkillTemplate,
	listFirstPartySkillTemplates,
} from "@/lib/skills/catalog";
import {
	renderActiveSkillContext,
	stripSkillTraceForStorage,
} from "@/lib/skills/service";
import { describe, expect, it } from "vitest";

describe("first-party skill catalog", () => {
	it("exposes bounded first-party templates with immutable version ids", () => {
		const templates = listFirstPartySkillTemplates();

		expect(templates.length).toBeGreaterThanOrEqual(3);
		expect(templates).toEqual(FIRST_PARTY_SKILL_TEMPLATES);
		for (const template of templates) {
			expect(template.id).toMatch(/^[a-z0-9-]+$/);
			expect(template.versionId).toMatch(/^v\d+$/);
			expect(template.source).toBe("first_party");
			expect(template.status).toBe("listed");
			expect(template.riskLevel).toBe("low");
			expect(template.instructions.workflow.length).toBeGreaterThan(0);
		}
	});

	it("requires matching template and version when resolving a skill", () => {
		expect(
			getFirstPartySkillTemplate("technical-prd-writer", "v1")?.title
		).toBe("Technical PRD Writer");
		expect(getFirstPartySkillTemplate("technical-prd-writer", "v999")).toBe(
			null
		);
		expect(getFirstPartySkillTemplate("unknown-skill", "v1")).toBe(null);
	});

	it("validates user-created private skill manifests", () => {
		const parsed = createSkillTemplateSchema.safeParse({
			name: "Support Reply Coach",
			description:
				"Helps turn messy customer context into a clear, empathetic response.",
			whenToUse:
				"Use this when the user asks for help replying to a customer.",
			instructions:
				"Identify the problem, answer it directly, and list missing context.",
			outputFormat:
				"Return the reply first, followed by a short internal note.",
			examples: [
				{
					userRequest: "Reply to a customer whose refund is delayed.",
					idealResponse:
						"Apologize, explain the expected timeline, and offer a next step.",
				},
			],
			isEnabled: true,
		});

		expect(parsed.success).toBe(true);
	});

	it("does not accept tools in user-created skill input", () => {
		const parsed = createSkillTemplateSchema.safeParse({
			name: "SQL Helper",
			description:
				"Explains SQL queries and suggests safer alternatives.",
			whenToUse:
				"Use this when the user asks for help understanding or writing SQL.",
			instructions:
				"Explain the query first, then provide a corrected version when needed.",
			outputFormat: "",
			examples: [],
			isEnabled: true,
			tools: ["database.query"],
		});

		expect(parsed.success).toBe(false);
	});

	it("keeps rendered skill instructions out of persisted traces", () => {
		const trace = {
			items: [
				{
					installedSkillId: "installed-1",
					templateId: "custom-template-1",
					versionId: "version-1",
					title: "Custom Coach",
					source: "user" as const,
					scope: "conversation" as const,
					riskLevel: "low" as const,
					requiredTools: [],
				},
			],
			renderHash: "hash-1",
			renderedContext: "private instruction block",
		};

		expect(renderActiveSkillContext(trace)).toBe(
			"private instruction block"
		);
		expect(stripSkillTraceForStorage(trace)).toEqual({
			items: trace.items,
			renderHash: "hash-1",
		});
	});
});
