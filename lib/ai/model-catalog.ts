export interface ModelCapabilities {
	supportsText: boolean;
	supportsStreaming: boolean;
	supportsStructuredOutput: boolean;
	supportsImages: boolean;
	supportsAudioInput: boolean;
	supportsAudioTranscription: boolean;
	supportsImageGeneration: boolean;
	supportsDocumentAttachments: boolean;
	supportsEmbeddings: boolean;
	supportsDocumentAi: boolean;
	supportsModeration: boolean;
	supportsPromptCaching: boolean;
	supportsNativeWebSearch: boolean;
	supportsFunctionCalling: boolean;
	supportsProviderTools: boolean;
}

export interface ChatModelMetadata {
	id: string;
	resolvedId: string;
	name: string;
	description: string;
	provider: string;
	contextWindow: string;
	isFavorite?: boolean;
	/** Human-readable version tag (e.g. "v26.04") */
	version?: string;
	/** Open-weight / open-source flag */
	isOpen?: boolean;
	capabilities: ModelCapabilities;
}

export const DOCUMENT_ATTACHMENT_ACCEPT =
	".pdf,.txt,.md,.markdown,.csv,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.css,.html,.json,.sql,.yaml,.yml,.xml";
export const IMAGE_ATTACHMENT_ACCEPT =
	".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

// ── Capability presets ─────────────────────────────────────────────────────

const TEXT_DOCUMENT_CAPABILITIES: ModelCapabilities = {
	supportsText: true,
	supportsStreaming: true,
	supportsStructuredOutput: false,
	supportsImages: false,
	supportsAudioInput: false,
	supportsAudioTranscription: false,
	supportsImageGeneration: false,
	supportsDocumentAttachments: true,
	supportsEmbeddings: false,
	supportsDocumentAi: false,
	supportsModeration: false,
	supportsPromptCaching: false,
	supportsNativeWebSearch: false,
	supportsFunctionCalling: false,
	supportsProviderTools: false,
};

const TEXT_VISION_DOCUMENT_CAPABILITIES: ModelCapabilities = {
	...TEXT_DOCUMENT_CAPABILITIES,
	supportsImages: true,
};

const TEXT_VISION_FC_CAPABILITIES: ModelCapabilities = {
	...TEXT_VISION_DOCUMENT_CAPABILITIES,
	supportsFunctionCalling: true,
};

const TEXT_FC_CAPABILITIES: ModelCapabilities = {
	...TEXT_DOCUMENT_CAPABILITIES,
	supportsFunctionCalling: true,
};

const TEXT_STRUCTURED_FC_CAPABILITIES: ModelCapabilities = {
	...TEXT_DOCUMENT_CAPABILITIES,
	supportsStructuredOutput: true,
	supportsFunctionCalling: true,
	supportsPromptCaching: true,
};

const AUDIO_CHAT_CAPABILITIES: ModelCapabilities = {
	supportsText: true,
	supportsStreaming: true,
	supportsStructuredOutput: false,
	supportsImages: false,
	supportsAudioInput: true,
	supportsAudioTranscription: false,
	supportsImageGeneration: false,
	supportsDocumentAttachments: true,
	supportsEmbeddings: false,
	supportsDocumentAi: false,
	supportsModeration: false,
	supportsPromptCaching: false,
	supportsNativeWebSearch: false,
	supportsFunctionCalling: false,
	supportsProviderTools: false,
};

const AUDIO_FC_CAPABILITIES: ModelCapabilities = {
	...AUDIO_CHAT_CAPABILITIES,
	supportsFunctionCalling: true,
};

const AUDIO_TRANSCRIPTION_CAPABILITIES: ModelCapabilities = {
	supportsText: false,
	supportsStreaming: true,
	supportsStructuredOutput: false,
	supportsImages: false,
	supportsAudioInput: true,
	supportsAudioTranscription: true,
	supportsImageGeneration: false,
	supportsDocumentAttachments: false,
	supportsEmbeddings: false,
	supportsDocumentAi: false,
	supportsModeration: false,
	supportsPromptCaching: false,
	supportsNativeWebSearch: false,
	supportsFunctionCalling: false,
	supportsProviderTools: false,
};

export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities =
	TEXT_DOCUMENT_CAPABILITIES;

// ── Chat model catalogue (reflects docs.mistral.ai as of June 2026) ────────
//
//  GENERALIST models (active / recommended)
//  ─────────────────────────────────────────
//  • Mistral Large 3    – open-weight, multimodal MoE, 256 K ctx  (v25.12)
//  • Mistral Medium 3.5 – frontier multimodal, agentic + coding    (v26.04)
//  • Mistral Small 4    – hybrid instruct/reason/code/vision       (v26.03)
//  • Ministral 3 14B    – edge, text + vision                      (v25.12)
//  • Ministral 3 8B     – edge, text + vision                      (v25.12)
//  • Ministral 3 3B     – tiny edge, text + vision                 (v25.12)
//  • Mistral Nemo 12B   – open-weight, text only                   (24.07)
//
//  SPECIALIST models
//  ─────────────────
//  • Devstral 2         – frontier code-agent model                (v25.12)
//  • Codestral          – code completion, 256 K ctx               (v25.08)
//  • Voxtral Small      – audio-capable instruct + function call   (v25.07)
//  • Voxtral Mini       – audio chat (non-FC)                      (v26.02 realtime)

export const CHAT_MODELS: ChatModelMetadata[] = [
	// ── Flagship / Frontier ─────────────────────────────────────────────────
	{
		id: "mistral-large",
		resolvedId: "mistral-large-latest",
		name: "Mistral Large 3",
		description:
			"State-of-the-art open-weight multimodal model (MoE) for complex reasoning, vision, and general-purpose tasks.",
		provider: "Mistral",
		contextWindow: "256K context",
		version: "v25.12",
		isOpen: true,
		isFavorite: true,
		capabilities: TEXT_VISION_FC_CAPABILITIES,
	},
	{
		id: "mistral-medium",
		resolvedId: "mistral-medium-latest",
		name: "Mistral Medium 3.5",
		description:
			"Frontier-class multimodal model optimised for agentic workflows and coding tasks.",
		provider: "Mistral",
		contextWindow: "256K context",
		version: "v26.04",
		isOpen: true,
		isFavorite: false,
		capabilities: TEXT_VISION_FC_CAPABILITIES,
	},
	{
		id: "mistral-small",
		resolvedId: "mistral-small-latest",
		name: "Mistral Small 4",
		description:
			"Hybrid model unifying instruction-following, reasoning, and coding in a single efficient architecture.",
		provider: "Mistral",
		contextWindow: "256K context",
		version: "v26.03",
		isOpen: true,
		isFavorite: true,
		capabilities: TEXT_VISION_FC_CAPABILITIES,
	},

	// ── Edge / Ministral 3 series ────────────────────────────────────────────
	{
		id: "ministral-14b",
		resolvedId: "ministral-14b-latest",
		name: "Ministral 3 14B",
		description:
			"Powerful Ministral 3 model with best-in-class text and vision capabilities for edge deployment.",
		provider: "Mistral",
		contextWindow: "128K context",
		version: "v25.12",
		isOpen: true,
		isFavorite: false,
		capabilities: TEXT_VISION_DOCUMENT_CAPABILITIES,
	},
	{
		id: "ministral-8b",
		resolvedId: "ministral-8b-latest",
		name: "Ministral 3 8B",
		description:
			"Efficient 8B Ministral 3 model with best-in-class text and vision for resource-constrained deployments.",
		provider: "Mistral",
		contextWindow: "128K context",
		version: "v25.12",
		isOpen: true,
		isFavorite: true,
		capabilities: TEXT_VISION_DOCUMENT_CAPABILITIES,
	},
	{
		id: "ministral-3b",
		resolvedId: "ministral-3b-latest",
		name: "Ministral 3 3B",
		description:
			"Tiny yet capable Ministral 3 model – ideal for on-device / edge inference with vision support.",
		provider: "Mistral",
		contextWindow: "128K context",
		version: "v25.12",
		isOpen: true,
		isFavorite: false,
		capabilities: TEXT_VISION_DOCUMENT_CAPABILITIES,
	},

	// ── Open-weight legacy ───────────────────────────────────────────────────
	{
		id: "open-mistral-nemo",
		resolvedId: "open-mistral-nemo",
		name: "Mistral Nemo 12B",
		description:
			"Fully open-weight 12B model fine-tuned for multilingual instruction following.",
		provider: "Mistral",
		contextWindow: "128K context",
		version: "24.07",
		isOpen: true,
		isFavorite: false,
		capabilities: TEXT_FC_CAPABILITIES,
	},

	// ── Specialist: Coding ───────────────────────────────────────────────────
	{
		id: "devstral",
		resolvedId: "devstral-latest",
		name: "Devstral 2",
		description:
			"Frontier code-agent model purpose-built for solving software-engineering tasks autonomously.",
		provider: "Mistral",
		contextWindow: "256K context",
		version: "v25.12",
		isOpen: false,
		isFavorite: true,
		capabilities: TEXT_FC_CAPABILITIES,
	},
	{
		id: "codestral",
		resolvedId: "codestral-latest",
		name: "Codestral",
		description:
			"Cutting-edge code-completion model with fill-in-the-middle support and 256 K context.",
		provider: "Mistral",
		contextWindow: "256K context",
		version: "v25.08",
		isOpen: false,
		isFavorite: true,
		capabilities: TEXT_DOCUMENT_CAPABILITIES,
	},

	// ── Specialist: Audio ────────────────────────────────────────────────────
	{
		id: "voxtral-small",
		resolvedId: "voxtral-small-latest",
		name: "Voxtral Small",
		description:
			"First Mistral model with native audio-input for instruction and function-calling use cases.",
		provider: "Mistral",
		contextWindow: "32K context",
		version: "v25.07",
		isOpen: true,
		isFavorite: false,
		capabilities: AUDIO_FC_CAPABILITIES,
	},
	{
		id: "voxtral-mini",
		resolvedId: "voxtral-mini-latest",
		name: "Voxtral Mini",
		description:
			"Efficient audio input model optimised for real-time transcription and live voice chat.",
		provider: "Mistral",
		contextWindow: "32K context",
		version: "v26.02",
		isOpen: true,
		isFavorite: false,
		capabilities: AUDIO_TRANSCRIPTION_CAPABILITIES,
	},

	// ── Controlled gateway expansion ─────────────────────────────────────────
	{
		id: "gpt-5.1",
		resolvedId: "gpt-5.1",
		name: "GPT-5.1",
		description:
			"OpenAI Responses model available only through AI Gateway rollout controls.",
		provider: "OpenAI",
		contextWindow: "provider configured",
		version: "Phase 3 gateway",
		isOpen: false,
		isFavorite: false,
		capabilities: TEXT_STRUCTURED_FC_CAPABILITIES,
	},
];

// ── Model alias map ────────────────────────────────────────────────────────
// Maps every known model id / versioned alias → canonical resolvedId so the
// backend can normalise whatever the client sends.

const MODEL_ALIAS_ENTRIES = [
	// Dynamic entries from CHAT_MODELS
	...CHAT_MODELS.flatMap((model) => [
		[model.id, model.resolvedId],
		[model.resolvedId, model.resolvedId],
	]),
	// Versioned aliases – Generalist
	["mistral-large-latest", "mistral-large-latest"],
	["mistral-large-2512", "mistral-large-2512"],
	["mistral-medium-latest", "mistral-medium-latest"],
	["mistral-medium-2604", "mistral-medium-2604"],
	["mistral-medium-2508", "mistral-medium-2508"],
	["mistral-small-latest", "mistral-small-latest"],
	["mistral-small-2603", "mistral-small-2603"],
	["mistral-small-2506", "mistral-small-2506"],
	// Versioned aliases – Ministral 3 series
	["ministral-14b-latest", "ministral-14b-latest"],
	["ministral-14b-2512", "ministral-14b-2512"],
	["ministral-8b-latest", "ministral-8b-latest"],
	["ministral-8b-2512", "ministral-8b-2512"],
	["ministral-3b-latest", "ministral-3b-latest"],
	["ministral-3b-2512", "ministral-3b-2512"],
	// Versioned aliases – Nemo
	["open-mistral-nemo-2407", "open-mistral-nemo-2407"],
	// Versioned aliases – Coding
	["devstral-latest", "devstral-latest"],
	["devstral-2-2512", "devstral-2-2512"],
	["codestral-latest", "codestral-latest"],
	["codestral-2508", "codestral-2508"],
	// Versioned aliases – Audio
	["voxtral-small-latest", "voxtral-small-latest"],
	["voxtral-small-2507", "voxtral-small-latest"],
	["voxtral-mini-latest", "voxtral-mini-latest"],
	["voxtral-mini-2602", "voxtral-mini-latest"],
	// Legacy / redirect aliases
	["pixtral-large", "mistral-large-latest"],
	["pixtral-large-latest", "mistral-large-latest"],
	["mistral-large-2411", "mistral-large-2512"],
	// Controlled gateway aliases
	["gpt-5.1", "gpt-5.1"],
	["openai:gpt-5.1", "gpt-5.1"],
] as const;

// ── Capability lookup sets ─────────────────────────────────────────────────

const VISION_MODEL_IDS = new Set([
	"mistral-large-latest",
	"mistral-large-2512",
	"mistral-medium-latest",
	"mistral-medium-2604",
	"mistral-medium-2508",
	"mistral-small-latest",
	"mistral-small-2603",
	"mistral-small-2506",
	"ministral-14b-latest",
	"ministral-14b-2512",
	"ministral-8b-latest",
	"ministral-8b-2512",
	"ministral-3b-latest",
	"ministral-3b-2512",
]);

const AUDIO_CHAT_MODEL_IDS = new Set([
	"voxtral-small-latest",
	"voxtral-small-2507",
	"voxtral-mini-latest",
	"voxtral-mini-2602",
]);

const AUDIO_TRANSCRIPTION_MODEL_IDS = new Set([
	"voxtral-mini-latest",
	"voxtral-mini-2602",
]);

const FUNCTION_CALLING_MODEL_IDS = new Set([
	"mistral-large-latest",
	"mistral-large-2512",
	"mistral-medium-latest",
	"mistral-medium-2604",
	"mistral-medium-2508",
	"mistral-small-latest",
	"mistral-small-2603",
	"mistral-small-2506",
	"devstral-latest",
	"devstral-2-2512",
	"open-mistral-nemo-2407",
	"voxtral-small-latest",
	"voxtral-small-2507",
]);

// ── Public API ─────────────────────────────────────────────────────────────

export const SUPPORTED_MODELS: Record<string, string> =
	Object.fromEntries(MODEL_ALIAS_ENTRIES);

export function normalizeModelId(model: string): string | null {
	return SUPPORTED_MODELS[model] ?? null;
}

export function getSupportedModelAliases(): string[] {
	return Object.keys(SUPPORTED_MODELS);
}

export function getChatModelMetadata(model: string) {
	const normalizedModel = normalizeModelId(model) ?? model;
	return CHAT_MODELS.find(
		(metadata) =>
			metadata.id === model ||
			metadata.resolvedId === model ||
			metadata.resolvedId === normalizedModel
	);
}

export function getModelCapabilities(model: string): ModelCapabilities {
	const normalizedModel = normalizeModelId(model) ?? model;
	const metadata = getChatModelMetadata(model);
	const base =
		metadata?.capabilities ??
		(AUDIO_CHAT_MODEL_IDS.has(normalizedModel)
			? AUDIO_CHAT_CAPABILITIES
			: TEXT_DOCUMENT_CAPABILITIES);

	return {
		...base,
		supportsImages:
			base.supportsImages || VISION_MODEL_IDS.has(normalizedModel),
		supportsAudioInput:
			base.supportsAudioInput ||
			AUDIO_CHAT_MODEL_IDS.has(normalizedModel),
		supportsAudioTranscription:
			base.supportsAudioTranscription ||
			AUDIO_TRANSCRIPTION_MODEL_IDS.has(normalizedModel),
		supportsStreaming: base.supportsStreaming,
		supportsStructuredOutput: base.supportsStructuredOutput,
		supportsEmbeddings: base.supportsEmbeddings,
		supportsDocumentAi: base.supportsDocumentAi,
		supportsModeration: base.supportsModeration,
		supportsPromptCaching: base.supportsPromptCaching,
		supportsFunctionCalling:
			base.supportsFunctionCalling ||
			FUNCTION_CALLING_MODEL_IDS.has(normalizedModel),
		supportsNativeWebSearch: base.supportsNativeWebSearch,
		supportsProviderTools: base.supportsProviderTools,
	};
}
