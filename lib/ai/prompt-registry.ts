import { createHash } from "node:crypto";
import { z } from "zod";

export const PROMPT_REGISTRY_VERSION = "prompt-registry-v1";

export const promptRegistryRecordSchema = z.object({
	id: z.string().min(1),
	version: z.string().min(1),
	contentHash: z.string().min(16),
	sourcePath: z.string().min(1),
	changelog: z.string().min(1),
	compatibleModels: z.array(z.string().min(1)),
	requiredEvalSuites: z.array(z.string().min(1)),
	rolloutState: z.enum([
		"disabled",
		"shadow",
		"canary",
		"default",
		"deprecated",
	]),
});

export type PromptRegistryRecord = z.infer<typeof promptRegistryRecordSchema>;

function hashPromptDescriptor(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

export const promptRegistry: PromptRegistryRecord[] = [
	{
		id: "chat-context",
		version: "chat-context-v1",
		contentHash: hashPromptDescriptor(
			"lib/ai/context-builder.ts:chat-context-v1"
		),
		sourcePath: "lib/ai/context-builder.ts",
		changelog:
			"Initial versioned chat context prompt with RAG/tool context boundaries.",
		compatibleModels: ["mistral-small-latest", "gpt-5.1"],
		requiredEvalSuites: [
			"chat_general.v1",
			"rag_qa.v1",
			"safety_prompt_injection.v1",
		],
		rolloutState: "default",
	},
	{
		id: "share-summary",
		version: "share-summary-v1",
		contentHash: hashPromptDescriptor(
			"lib/share/summary.ts:share-summary-v1"
		),
		sourcePath: "lib/share/summary.ts",
		changelog: "Strict JSON summary output contract.",
		compatibleModels: ["ministral-3b-latest"],
		requiredEvalSuites: ["chat_general.v1"],
		rolloutState: "default",
	},
	{
		id: "conversation-title",
		version: "conversation-title-v1",
		contentHash: hashPromptDescriptor(
			"lib/conversations/generate-title.ts:conversation-title-v1"
		),
		sourcePath: "lib/conversations/generate-title.ts",
		changelog:
			"Strict JSON title output contract with legacy text fallback.",
		compatibleModels: ["ministral-3b-latest"],
		requiredEvalSuites: ["chat_general.v1"],
		rolloutState: "default",
	},
];

export function validatePromptRegistry(records = promptRegistry) {
	return records.map((record) => promptRegistryRecordSchema.parse(record));
}
