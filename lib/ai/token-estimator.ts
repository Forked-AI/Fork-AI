import type { ProviderMessage } from "@/lib/chat-system-prompt";

export interface TokenEstimator {
	estimateTextTokens(_text: string): number;
	estimateMessageTokens(_message: ProviderMessage): number;
	estimateMessagesTokens(_messages: ProviderMessage[]): number;
}

export interface TokenEstimatorOptions {
	charsPerToken: number;
	messageOverheadTokens: number;
}

export interface TokenEstimatorSelection {
	providerName?: string;
	model?: string;
	options?: Partial<TokenEstimatorOptions>;
}

const DEFAULT_CHARS_PER_TOKEN = 4;
const DEFAULT_MESSAGE_OVERHEAD_TOKENS = 4;
const DEFAULT_IMAGE_INPUT_TOKENS = 1000;
const DEFAULT_MAX_INPUT_TOKENS = 24_000;

const PROVIDER_ESTIMATOR_OVERRIDES: Record<
	string,
	Partial<TokenEstimatorOptions>
> = {
	mistral: {
		charsPerToken: 4,
		messageOverheadTokens: 4,
	},
};

const MODEL_MAX_INPUT_TOKEN_OVERRIDES: Record<string, number> = {
	"mistral-large-latest": 256_000,
	"mistral-large-2512": 256_000,
	"mistral-medium-latest": 256_000,
	"mistral-medium-2604": 256_000,
	"mistral-medium-3-5": 256_000,
	"mistral-medium-2508": 256_000,
	"mistral-small-latest": 256_000,
	"mistral-small-2603": 256_000,
	"mistral-small-2506": 256_000,
	"open-mistral-nemo": 128_000,
	"codestral-latest": 256_000,
	"codestral-2508": 256_000,
	"ministral-14b-latest": 256_000,
	"ministral-14b-2512": 256_000,
	"ministral-8b-latest": 256_000,
	"ministral-8b-2512": 256_000,
	"ministral-3b-latest": 256_000,
	"ministral-3b-2512": 256_000,
	"voxtral-mini-latest": 32_000,
	"voxtral-small-latest": 32_000,
};

function parsePositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEstimatorOptions(
	selection: TokenEstimatorSelection = {}
): TokenEstimatorOptions {
	const providerOverride = selection.providerName
		? PROVIDER_ESTIMATOR_OVERRIDES[selection.providerName]
		: undefined;

	return {
		charsPerToken: parsePositiveInt(
			process.env.CHAT_CONTEXT_CHARS_PER_TOKEN,
			selection.options?.charsPerToken ??
				providerOverride?.charsPerToken ??
				DEFAULT_CHARS_PER_TOKEN
		),
		messageOverheadTokens: parsePositiveInt(
			process.env.CHAT_CONTEXT_MESSAGE_OVERHEAD_TOKENS,
			selection.options?.messageOverheadTokens ??
				providerOverride?.messageOverheadTokens ??
				DEFAULT_MESSAGE_OVERHEAD_TOKENS
		),
	};
}

function estimateProviderContentTokens(
	message: ProviderMessage,
	charsPerToken: number
) {
	if (typeof message.content === "string") {
		return Math.max(1, Math.ceil(message.content.length / charsPerToken));
	}

	return message.content.reduce((total, part) => {
		if (part.type === "text") {
			return (
				total + Math.max(1, Math.ceil(part.text.length / charsPerToken))
			);
		}

		return total + DEFAULT_IMAGE_INPUT_TOKENS;
	}, 0);
}

export function createTokenEstimator(
	selection: TokenEstimatorSelection = {}
): TokenEstimator {
	const options = normalizeEstimatorOptions(selection);

	return {
		estimateTextTokens(text: string) {
			return Math.max(1, Math.ceil(text.length / options.charsPerToken));
		},
		estimateMessageTokens(message: ProviderMessage) {
			return (
				options.messageOverheadTokens +
				estimateProviderContentTokens(message, options.charsPerToken)
			);
		},
		estimateMessagesTokens(messages: ProviderMessage[]) {
			return messages.reduce(
				(total, message) => total + this.estimateMessageTokens(message),
				0
			);
		},
	};
}

export function resolveMaxInputTokens({
	providerName,
	model,
	fallback = DEFAULT_MAX_INPUT_TOKENS,
}: {
	providerName?: string;
	model?: string;
	fallback?: number;
}) {
	const modelKey = model ? model.toLowerCase() : "";
	const providerKey = providerName ? providerName.toUpperCase() : "";
	const envModelKey = modelKey
		? `CHAT_CONTEXT_${modelKey
				.replace(/[^a-z0-9]+/g, "_")
				.toUpperCase()}_MAX_INPUT_TOKENS`
		: "";
	const envProviderKey = providerKey
		? `CHAT_CONTEXT_${providerKey}_MAX_INPUT_TOKENS`
		: "";

	if (envModelKey && process.env[envModelKey]) {
		return parsePositiveInt(process.env[envModelKey], fallback);
	}

	if (envProviderKey && process.env[envProviderKey]) {
		return parsePositiveInt(process.env[envProviderKey], fallback);
	}

	return parsePositiveInt(
		process.env.CHAT_CONTEXT_MAX_INPUT_TOKENS,
		modelKey
			? (MODEL_MAX_INPUT_TOKEN_OVERRIDES[modelKey] ?? fallback)
			: fallback
	);
}
