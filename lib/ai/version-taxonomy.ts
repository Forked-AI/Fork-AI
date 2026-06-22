export const AI_TASK_IDS = [
	"chat.general",
	"chat.reasoning",
	"chat.code",
	"rag.qa",
	"share.summary",
	"conversation.title",
	"tool.plan",
	"eval.judge",
	"moderation.classify",
] as const;

export type AiTaskId = (typeof AI_TASK_IDS)[number];

export const AI_ARTIFACT_VERSION_KEYS = [
	"promptVersion",
	"retrievalConfigVersion",
	"embeddingConfigVersion",
	"toolRegistryVersion",
	"safetyPolicyVersion",
	"modelRoutePolicyVersion",
	"evalDatasetVersion",
	"judgePromptVersion",
] as const;

export type AiArtifactVersionKey = (typeof AI_ARTIFACT_VERSION_KEYS)[number];

export const AI_ARTIFACT_VERSIONS = {
	promptVersion: "chat-context-v1",
	retrievalConfigVersion: "rag-hybrid-retrieval-v2",
	embeddingConfigVersion: "local-hash-embedding-v1",
	toolRegistryVersion: "tool-registry-v1",
	safetyPolicyVersion: "moderation-policy-v1",
	modelRoutePolicyVersion: "ai-gateway-route-v1",
	evalDatasetVersion: "none",
	judgePromptVersion: "none",
} as const satisfies Record<AiArtifactVersionKey, string>;

export type AiArtifactVersions = typeof AI_ARTIFACT_VERSIONS;

export const AI_TASK_DEFAULT_ARTIFACTS = {
	"chat.general": [
		"promptVersion",
		"retrievalConfigVersion",
		"embeddingConfigVersion",
		"toolRegistryVersion",
		"safetyPolicyVersion",
		"modelRoutePolicyVersion",
	],
	"chat.reasoning": [
		"promptVersion",
		"safetyPolicyVersion",
		"modelRoutePolicyVersion",
	],
	"chat.code": [
		"promptVersion",
		"retrievalConfigVersion",
		"embeddingConfigVersion",
		"toolRegistryVersion",
		"safetyPolicyVersion",
		"modelRoutePolicyVersion",
	],
	"rag.qa": [
		"retrievalConfigVersion",
		"embeddingConfigVersion",
		"safetyPolicyVersion",
	],
	"share.summary": [
		"promptVersion",
		"safetyPolicyVersion",
		"modelRoutePolicyVersion",
	],
	"conversation.title": [
		"promptVersion",
		"safetyPolicyVersion",
		"modelRoutePolicyVersion",
	],
	"tool.plan": ["toolRegistryVersion", "safetyPolicyVersion"],
	"eval.judge": ["evalDatasetVersion", "judgePromptVersion"],
	"moderation.classify": ["safetyPolicyVersion"],
} as const satisfies Record<AiTaskId, readonly AiArtifactVersionKey[]>;

export function isAiTaskId(value: string): value is AiTaskId {
	return (AI_TASK_IDS as readonly string[]).includes(value);
}

export function getAiArtifactVersionsForTask(
	taskId: AiTaskId,
	overrides: Partial<Record<AiArtifactVersionKey, string>> = {}
) {
	const taskVersionKeys = AI_TASK_DEFAULT_ARTIFACTS[taskId];

	return Object.fromEntries(
		taskVersionKeys.map((key) => [
			key,
			overrides[key] ?? AI_ARTIFACT_VERSIONS[key],
		])
	) as Pick<AiArtifactVersions, (typeof taskVersionKeys)[number]>;
}
