import { z } from "zod";

export const skillActivationScopeSchema = z.enum(["turn", "conversation"]);

export const skillActivationSchema = z.object({
	installedSkillId: z.string().trim().min(1).max(120),
	scope: skillActivationScopeSchema.default("turn"),
});

export const installSkillSchema = z.object({
	templateId: z.string().trim().min(1).max(120),
	versionId: z.string().trim().min(1).max(120).optional(),
});

export const skillExampleSchema = z.object({
	userRequest: z.string().trim().min(1).max(2_000),
	idealResponse: z.string().trim().min(1).max(4_000),
});

export const createSkillTemplateSchema = z
	.object({
		name: z.string().trim().min(3).max(80),
		description: z.string().trim().min(10).max(500),
		whenToUse: z.string().trim().min(10).max(2_000),
		instructions: z.string().trim().min(10).max(8_000),
		outputFormat: z.string().trim().max(2_000).optional().default(""),
		examples: z.array(skillExampleSchema).max(8).default([]),
		isEnabled: z.boolean().default(true),
	})
	.strict();

export const updateInstalledSkillSchema = z.object({
	alias: z.string().trim().min(1).max(80).nullable().optional(),
	pinned: z.boolean().optional(),
	enabled: z.boolean().optional(),
	defaultScope: skillActivationScopeSchema.nullable().optional(),
	settings: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const createSkillCollectionSchema = z.object({
	name: z.string().trim().min(1).max(80),
	description: z.string().trim().max(300).nullable().optional(),
});

export const updateSkillCollectionSchema =
	createSkillCollectionSchema.partial();

export const skillCollectionItemSchema = z.object({
	installedSkillId: z.string().trim().min(1).max(120),
});

export type SkillActivationScope = z.infer<typeof skillActivationScopeSchema>;
export type SkillActivationInput = z.infer<typeof skillActivationSchema>;
export type CreateSkillTemplateInput = z.infer<
	typeof createSkillTemplateSchema
>;
export type SkillExample = z.infer<typeof skillExampleSchema>;

export interface SkillTemplate {
	id: string;
	versionId: string;
	versionNumber: number;
	title: string;
	summary: string;
	description: string;
	category: string;
	tags: string[];
	source: "first_party" | "user";
	ownerId: string | null;
	visibility: "private" | "unlisted" | "public" | "org";
	status:
		| "draft"
		| "submitted"
		| "listed"
		| "limited"
		| "removed"
		| "deprecated";
	updateAvailable?: boolean;
	riskLevel: "low" | "medium" | "high";
	requiredTools: string[];
	settings: {
		temperature?: number;
		preferredModels?: string[];
	};
	whenToUse?: string;
	mainInstructions?: string;
	outputFormat?: string | null;
	examples?: SkillExample[];
	instructions: {
		role: string;
		workflow: string[];
		outputContract: string;
	};
}

export interface InstalledSkillView {
	id: string;
	templateId: string;
	versionId: string;
	currentVersionId: string;
	alias: string | null;
	enabled: boolean;
	pinned: boolean;
	defaultScope: SkillActivationScope | null;
	settingsJson: unknown | null;
	installedAt: string;
	lastUsedAt: string | null;
	disabledAt: string | null;
	updateAvailable: boolean;
	template: SkillTemplate;
}

export interface SkillCollectionView {
	id: string;
	name: string;
	description: string | null;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
	items: InstalledSkillView[];
}

export interface ActiveSkillTraceItem {
	installedSkillId: string;
	templateId: string;
	versionId: string;
	title: string;
	source: SkillTemplate["source"];
	scope: SkillActivationScope;
	riskLevel: SkillTemplate["riskLevel"];
	requiredTools: string[];
}

export interface ActiveSkillTrace {
	items: ActiveSkillTraceItem[];
	renderHash: string;
	renderedContext?: string | null;
}

export const FIRST_PARTY_SKILL_TEMPLATES: SkillTemplate[] = [
	{
		id: "technical-prd-writer",
		versionId: "v1",
		versionNumber: 1,
		title: "Technical PRD Writer",
		summary: "Turn product ideas into implementation-ready specs.",
		description:
			"Structures ambiguous product requests into goals, non-goals, requirements, milestones, risks, acceptance criteria, and verification notes.",
		category: "product",
		tags: ["prd", "planning", "requirements"],
		source: "first_party",
		ownerId: null,
		visibility: "public",
		status: "listed",
		riskLevel: "low",
		requiredTools: [],
		settings: {
			temperature: 0.4,
			preferredModels: ["mistral-large-latest"],
		},
		instructions: {
			role: "You help create implementation-ready product and engineering specs.",
			workflow: [
				"Restate the user goal and the target audience.",
				"Separate goals, non-goals, constraints, assumptions, risks, and open questions.",
				"Convert the idea into phased milestones with acceptance criteria.",
				"Add test, UAT, analytics, rollout, and support notes where relevant.",
			],
			outputContract:
				"Return a clear implementation-ready PRD with concise headings and checklists.",
		},
	},
	{
		id: "code-reviewer",
		versionId: "v1",
		versionNumber: 1,
		title: "Code Reviewer",
		summary: "Review code for bugs, regressions, and missing tests.",
		description:
			"Prioritizes concrete findings with file references, severity, behavioral impact, and focused remediation guidance.",
		category: "engineering",
		tags: ["review", "quality", "tests"],
		source: "first_party",
		ownerId: null,
		visibility: "public",
		status: "listed",
		riskLevel: "low",
		requiredTools: [],
		settings: {
			temperature: 0.2,
		},
		instructions: {
			role: "You are reviewing code for correctness, maintainability, and regression risk.",
			workflow: [
				"Lead with concrete bugs and behavioral risks.",
				"Prefer exact file and line references when available.",
				"Call out missing tests only when they cover real risk.",
				"Keep summaries secondary to findings.",
			],
			outputContract:
				"Return findings ordered by severity, followed by open questions and a short test note.",
		},
	},
	{
		id: "research-brief",
		versionId: "v1",
		versionNumber: 1,
		title: "Research Brief",
		summary: "Synthesize sources into a decision-ready brief.",
		description:
			"Clusters evidence, separates observation from inference, identifies uncertainty, and turns research into actionable product moves.",
		category: "research",
		tags: ["research", "synthesis", "strategy"],
		source: "first_party",
		ownerId: null,
		visibility: "public",
		status: "listed",
		riskLevel: "low",
		requiredTools: [],
		settings: {
			temperature: 0.3,
		},
		instructions: {
			role: "You synthesize research into decision-ready product and technical briefs.",
			workflow: [
				"State the research scope and audience.",
				"Separate observed evidence from inference.",
				"Cluster findings by user problem, frequency signal, severity, and confidence.",
				"Recommend near-term, medium-term, and follow-up research moves.",
			],
			outputContract:
				"Return an executive read, ranked findings, source map, opportunity map, and open questions.",
		},
	},
];

const templateById = new Map(
	FIRST_PARTY_SKILL_TEMPLATES.map((template) => [template.id, template])
);

export function listFirstPartySkillTemplates() {
	return FIRST_PARTY_SKILL_TEMPLATES;
}

export function getFirstPartySkillTemplate(
	templateId: string,
	versionId?: string | null
) {
	const template = templateById.get(templateId) ?? null;
	if (!template) return null;
	if (versionId && template.versionId !== versionId) return null;
	return template;
}

export function toSkillBindingScope(scope: SkillActivationScope) {
	return scope === "conversation" ? "conversation" : "turn";
}

export function fromDbSkillBindingScope(
	scope: string | null | undefined
): SkillActivationScope | null {
	if (scope === "turn" || scope === "conversation") {
		return scope;
	}
	return null;
}
