import {
	AI_ARTIFACT_VERSION_KEYS,
	AI_ARTIFACT_VERSIONS,
	AI_TASK_DEFAULT_ARTIFACTS,
	AI_TASK_IDS,
	getAiArtifactVersionsForTask,
	isAiTaskId,
} from "@/lib/ai/version-taxonomy";
import { describe, expect, it } from "vitest";

describe("AI version taxonomy", () => {
	it("keeps every task mapped to at least one known artifact version key", () => {
		for (const taskId of AI_TASK_IDS) {
			const artifactKeys = AI_TASK_DEFAULT_ARTIFACTS[taskId];

			expect(artifactKeys.length).toBeGreaterThan(0);
			for (const artifactKey of artifactKeys) {
				expect(AI_ARTIFACT_VERSION_KEYS).toContain(artifactKey);
			}
		}
	});

	it("publishes current runtime artifact versions without private content", () => {
		expect(AI_ARTIFACT_VERSIONS).toMatchObject({
			promptVersion: "chat-context-v1",
			retrievalConfigVersion: "rag-hybrid-retrieval-v2",
			embeddingConfigVersion: "local-hash-embedding-v1",
			toolRegistryVersion: "tool-registry-v1",
			safetyPolicyVersion: "moderation-policy-v1",
			modelRoutePolicyVersion: "ai-gateway-route-v1",
		});
	});

	it("builds task-scoped version metadata with explicit overrides", () => {
		expect(
			getAiArtifactVersionsForTask("rag.qa", {
				embeddingConfigVersion: "mistral-embed-v1",
			})
		).toEqual({
			retrievalConfigVersion: "rag-hybrid-retrieval-v2",
			embeddingConfigVersion: "mistral-embed-v1",
			safetyPolicyVersion: "moderation-policy-v1",
		});
	});

	it("validates task IDs", () => {
		expect(isAiTaskId("chat.general")).toBe(true);
		expect(isAiTaskId("chat.unknown")).toBe(false);
	});
});
