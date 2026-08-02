export const AUTO_MODEL_ID = "auto";

export type AutoModelRoutingReason =
	| "vision"
	| "tool_use"
	| "rag_or_document"
	| "code"
	| "fast_simple"
	| "reasoning"
	| "balanced";

export interface AutoModelRoutingSignals {
	message: string;
	hasImageAttachments?: boolean;
	hasDocumentAttachments?: boolean;
	hasAudioInput?: boolean;
	hasRagContext?: boolean;
	enabledTools?: Array<"web.search">;
	activeSkillCount?: number;
	isGuest?: boolean;
}

export interface AutoModelRoutingDecision {
	model: string;
	reason: AutoModelRoutingReason;
}

const FAST_SIMPLE_MODEL = "ministral-8b-latest";
const BALANCED_MODEL = "mistral-small-latest";
const REASONING_MODEL = "mistral-large-latest";

const CODE_PROMPT_PATTERN =
	/\b(code|coding|debug|bug|stack trace|exception|typescript|javascript|python|react|next\.js|sql|prisma|api route|function|class|interface|component|refactor|compile|lint|test failure|implementation)\b|```|(?:^|\s)(?:import|export|const|let|var|async|await|def|class)\s+/i;

const REASONING_PROMPT_PATTERN =
	/\b(analyze|compare|evaluate|design|architect|architecture|strategy|tradeoff|plan|root cause|why|prove|derive|optimi[sz]e|step by step|deep dive|roadmap|spec|prd)\b/i;

function normalizePrompt(message: string) {
	return message.trim().replace(/\s+/g, " ");
}

function isSimplePrompt(message: string) {
	const normalized = normalizePrompt(message);
	if (normalized.length > 180) return false;
	if (normalized.includes("\n")) return false;
	if (CODE_PROMPT_PATTERN.test(normalized)) return false;
	if (REASONING_PROMPT_PATTERN.test(normalized)) return false;
	return normalized.split(/\s+/).length <= 28;
}

function isReasoningPrompt(message: string) {
	const normalized = normalizePrompt(message);
	return normalized.length > 1200 || REASONING_PROMPT_PATTERN.test(normalized);
}

function isCodePrompt(message: string) {
	return CODE_PROMPT_PATTERN.test(message);
}

export function isAutoModelRequest(model: string) {
	return model.trim().toLowerCase() === AUTO_MODEL_ID;
}

export function resolveAutoModelRoute(
	signals: AutoModelRoutingSignals
): AutoModelRoutingDecision {
	if (signals.hasImageAttachments) {
		return { model: REASONING_MODEL, reason: "vision" };
	}

	if (signals.enabledTools?.includes("web.search")) {
		return { model: BALANCED_MODEL, reason: "tool_use" };
	}

	if (signals.hasDocumentAttachments || signals.hasRagContext) {
		return { model: REASONING_MODEL, reason: "rag_or_document" };
	}

	if (isCodePrompt(signals.message)) {
		return { model: BALANCED_MODEL, reason: "code" };
	}

	if (isSimplePrompt(signals.message)) {
		return { model: FAST_SIMPLE_MODEL, reason: "fast_simple" };
	}

	if (isReasoningPrompt(signals.message)) {
		return { model: REASONING_MODEL, reason: "reasoning" };
	}

	return { model: BALANCED_MODEL, reason: "balanced" };
}
