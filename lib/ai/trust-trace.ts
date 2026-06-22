import type { ActiveSkillTrace } from "@/lib/skills/catalog";

export type AiEvidenceState =
	| "grounded"
	| "partially_grounded"
	| "no_file_evidence"
	| "model_only"
	| "used_web_search";

export interface TrustTraceCitation {
	index: number;
	chunkId: string;
	fileId: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
}

export interface TrustTraceTool {
	id: string;
	name: string;
	status: string;
	riskLevel: string | null;
	requiresConfirmation: boolean;
}

export interface TrustTraceSkill {
	title: string;
	templateId: string;
	versionId: string;
	source: "first_party" | "user";
}

export interface MessageTrustTrace {
	traceId: string | null;
	generationId: string | null;
	providerRequestId: string | null;
	provider: string | null;
	selectedModel: string | null;
	resolvedModel: string | null;
	fallbackUsed: boolean;
	promptVersion: string | null;
	generationStatus: string | null;
	evidenceState: AiEvidenceState;
	citationCount: number;
	citations: TrustTraceCitation[];
	usedTools: TrustTraceTool[];
	activeSkills: TrustTraceSkill[];
	context: {
		estimatedTokens: number | null;
		recentMessageCount: number | null;
		totalMessageCount: number | null;
		summaryUsed: boolean;
	};
}

interface RawToolExecution {
	id: string;
	toolName: string;
	status: string;
	riskLevel?: string | null;
	requiresConfirmation?: boolean | null;
}

interface RawUsageEvent {
	resolvedModel?: string | null;
	providerRequestId?: string | null;
}

interface RawGeneration {
	id: string;
	provider?: string | null;
	model?: string | null;
	status?: string | null;
	promptVersion?: string | null;
	contextSummaryId?: string | null;
	contextEstimatedTokens?: number | null;
	contextRecentMessageCount?: number | null;
	contextTotalMessageCount?: number | null;
	usageEvent?: RawUsageEvent | null;
	userMessage?: {
		toolExecutions?: RawToolExecution[];
	} | null;
}

interface RawMessageForTrustTrace {
	id: string;
	model?: string | null;
	providerRequestId?: string | null;
	promptVersion?: string | null;
	contextSummaryId?: string | null;
	contextEstimatedTokens?: number | null;
	contextRecentMessageCount?: number | null;
	contextTotalMessageCount?: number | null;
	ragCitationData?: string | null;
	activeSkillTraceJson?: unknown;
	generationAsAssistantMessage?: RawGeneration | null;
}

function parseCitations(
	value: string | null | undefined
): TrustTraceCitation[] {
	if (!value) return [];

	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isTrustTraceCitation);
	} catch {
		return [];
	}
}

function isTrustTraceCitation(value: unknown): value is TrustTraceCitation {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { index?: unknown }).index === "number" &&
		typeof (value as { chunkId?: unknown }).chunkId === "string" &&
		typeof (value as { fileId?: unknown }).fileId === "string" &&
		typeof (value as { sourceLabel?: unknown }).sourceLabel === "string" &&
		typeof (value as { score?: unknown }).score === "number"
	);
}

function isActiveSkillTrace(value: unknown): value is ActiveSkillTrace {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as { items?: unknown }).items)
	);
}

function resolveEvidenceState(options: {
	citations: TrustTraceCitation[];
	tools: RawToolExecution[];
}): AiEvidenceState {
	if (options.tools.some((tool) => tool.toolName === "web.search")) {
		return "used_web_search";
	}
	if (options.citations.length === 0) {
		return "model_only";
	}
	const strongestScore = Math.max(
		...options.citations.map((citation) => citation.score)
	);
	return strongestScore >= 0.65 ? "grounded" : "partially_grounded";
}

export function buildMessageTrustTrace(
	message: RawMessageForTrustTrace
): MessageTrustTrace {
	const generation = message.generationAsAssistantMessage ?? null;
	const citations = parseCitations(message.ragCitationData);
	const toolExecutions = generation?.userMessage?.toolExecutions ?? [];
	const activeSkillTrace = isActiveSkillTrace(message.activeSkillTraceJson)
		? message.activeSkillTraceJson
		: null;
	const resolvedModel = generation?.usageEvent?.resolvedModel ?? null;
	const selectedModel = generation?.model ?? message.model ?? null;

	return {
		traceId:
			generation?.usageEvent?.providerRequestId ??
			message.providerRequestId ??
			generation?.id ??
			null,
		generationId: generation?.id ?? null,
		providerRequestId:
			generation?.usageEvent?.providerRequestId ??
			message.providerRequestId ??
			null,
		provider: generation?.provider ?? null,
		selectedModel,
		resolvedModel,
		fallbackUsed:
			!!selectedModel &&
			!!resolvedModel &&
			selectedModel !== resolvedModel,
		promptVersion:
			generation?.promptVersion ?? message.promptVersion ?? null,
		generationStatus: generation?.status ?? null,
		evidenceState: resolveEvidenceState({
			citations,
			tools: toolExecutions,
		}),
		citationCount: citations.length,
		citations,
		usedTools: toolExecutions.map((tool) => ({
			id: tool.id,
			name: tool.toolName,
			status: tool.status,
			riskLevel: tool.riskLevel ?? null,
			requiresConfirmation: Boolean(tool.requiresConfirmation),
		})),
		activeSkills:
			activeSkillTrace?.items.map((skill) => ({
				title: skill.title,
				templateId: skill.templateId,
				versionId: skill.versionId,
				source: skill.source,
			})) ?? [],
		context: {
			estimatedTokens:
				generation?.contextEstimatedTokens ??
				message.contextEstimatedTokens ??
				null,
			recentMessageCount:
				generation?.contextRecentMessageCount ??
				message.contextRecentMessageCount ??
				null,
			totalMessageCount:
				generation?.contextTotalMessageCount ??
				message.contextTotalMessageCount ??
				null,
			summaryUsed: Boolean(
				generation?.contextSummaryId ?? message.contextSummaryId
			),
		},
	};
}
