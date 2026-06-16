import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logServerWarning } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export const MODERATION_POLICY_VERSION = "moderation-policy-v1";
const MAX_TEXT_SCAN_CHARS = 64_000;
const MAX_FILE_SCAN_BYTES = 256 * 1024;
const EICAR_TEST_MARKER = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

export type ModerationAction = "allow" | "block" | "review" | "degrade";
export type ModerationSeverity = "low" | "medium" | "high" | "critical";
export type ModerationCategory =
	| "none"
	| "child_safety"
	| "violence"
	| "self_harm"
	| "sexual_content"
	| "hate_harassment"
	| "illegal_activity"
	| "malware"
	| "credential_exfiltration"
	| "prompt_injection"
	| "privacy_spam"
	| "file_risk"
	| "provider_abuse"
	| "signup_abuse"
	| "output_risk";
export type ModerationSource =
	| "chat_message"
	| "file_upload"
	| "assistant_output"
	| "share_snapshot"
	| "account_export"
	| "signup"
	| "rate_limit"
	| "provider_response";
export type ModerationStage =
	| "pre_generation"
	| "file_upload"
	| "post_generation"
	| "share_create"
	| "account_export"
	| "abuse_signal";
export type AbuseSignalType =
	| "prompt_flooding"
	| "token_draining"
	| "provider_rate_limit"
	| "high_failure_rate"
	| "suspicious_signup"
	| "moderation_block"
	| "rate_limit_exceeded"
	| "file_scanner_block";

type ModerationPrismaClient = any;
type SafeMetadataValue = string | number | boolean | null | undefined;
type SafeMetadata = Record<string, SafeMetadataValue>;

export interface ModerationDecision {
	action: ModerationAction;
	category: ModerationCategory;
	severity: ModerationSeverity;
	reason: string;
	userMessage: string;
	matchedRuleIds: string[];
	policyVersion: string;
}

interface TextRule {
	id: string;
	category: Exclude<ModerationCategory, "none">;
	action: ModerationAction;
	severity: ModerationSeverity;
	reason: string;
	userMessage: string;
	patterns: RegExp[];
	sources?: ModerationSource[];
}

export interface ModerationEventInput {
	prismaClient?: ModerationPrismaClient;
	decision: ModerationDecision;
	source: ModerationSource;
	stage: ModerationStage;
	content?: string;
	contentHash?: string | null;
	contentLength?: number | null;
	userId?: string | null;
	conversationId?: string | null;
	messageId?: string | null;
	fileObjectId?: string | null;
	sharedConversationId?: string | null;
	metadata?: SafeMetadata;
}

export interface AbuseSignalInput {
	prismaClient?: ModerationPrismaClient;
	signalType: AbuseSignalType;
	severity: ModerationSeverity;
	action: ModerationAction;
	userId?: string | null;
	conversationId?: string | null;
	actorHash?: string | null;
	count?: number;
	windowSeconds?: number | null;
	provider?: string | null;
	model?: string | null;
	providerStatusCode?: number | null;
	metadata?: SafeMetadata;
}

const SEVERITY_RANK: Record<ModerationSeverity, number> = {
	low: 0,
	medium: 1,
	high: 2,
	critical: 3,
};

const ACTION_RANK: Record<ModerationAction, number> = {
	allow: 0,
	review: 1,
	degrade: 2,
	block: 3,
};

const TEXT_RULES: TextRule[] = [
	{
		id: "child-safety-csam",
		category: "child_safety",
		action: "block",
		severity: "critical",
		reason: "Potential child-safety sexual content request.",
		userMessage: "This request cannot be processed.",
		patterns: [
			/\b(?:csam|child sexual abuse material)\b/i,
			/\b(?:sexual|explicit)\s+(?:images?|content)\s+of\s+(?:children|minors)\b/i,
		],
	},
	{
		id: "malware-credential-stealer",
		category: "malware",
		action: "block",
		severity: "high",
		reason: "Potential malware, credential theft, or exfiltration request.",
		userMessage: "This request cannot be processed.",
		patterns: [
			/\b(?:write|create|build|generate)\b[\s\S]{0,80}\b(?:ransomware|keylogger|credential\s+stealer|malware|botnet)\b/i,
			/\b(?:steal|exfiltrate|dump)\b[\s\S]{0,60}\b(?:cookies|tokens|api\s+keys|passwords|credentials|secrets)\b/i,
		],
	},
	{
		id: "violence-weapons-instructions",
		category: "violence",
		action: "block",
		severity: "high",
		reason: "Potential violent or weapons instruction request.",
		userMessage: "This request cannot be processed.",
		patterns: [
			/\b(?:how\s+to|instructions?|steps?)\b[\s\S]{0,80}\b(?:assassinate|stab|shoot|poison|kill\s+someone)\b/i,
			/\b(?:build|make|assemble)\b[\s\S]{0,80}\b(?:bomb|explosive|pipe\s+bomb)\b/i,
		],
	},
	{
		id: "self-harm-methods",
		category: "self_harm",
		action: "block",
		severity: "high",
		reason: "Potential self-harm method request.",
		userMessage: "This request cannot be processed.",
		patterns: [
			/\b(?:how\s+to|best\s+way\s+to|instructions?)\b[\s\S]{0,80}\b(?:kill\s+myself|die\s+by\s+suicide|self[-\s]?harm)\b/i,
		],
	},
	{
		id: "illegal-abuse-instructions",
		category: "illegal_activity",
		action: "block",
		severity: "high",
		reason: "Potential illegal abuse instruction request.",
		userMessage: "This request cannot be processed.",
		patterns: [
			/\b(?:how\s+to|instructions?|steps?)\b[\s\S]{0,80}\b(?:bypass\s+kyc|forge\s+an?\s+id|launder\s+money|card\s+skimmer)\b/i,
		],
	},
	{
		id: "privacy-spam-bulk-harvest",
		category: "privacy_spam",
		action: "review",
		severity: "medium",
		reason: "Potential privacy-invasive scraping or spam request.",
		userMessage: "This request may need additional review.",
		patterns: [
			/\b(?:scrape|harvest|collect)\b[\s\S]{0,60}\b(?:emails?|phone\s+numbers?|addresses)\b/i,
			/\b(?:send|generate)\b[\s\S]{0,60}\b(?:bulk|mass)\s+(?:spam|phishing)\b/i,
		],
	},
	{
		id: "prompt-injection-override",
		category: "prompt_injection",
		action: "review",
		severity: "low",
		reason: "Prompt-injection language was detected and treated as user data.",
		userMessage: "This request may need additional review.",
		patterns: [
			/\bignore\s+(?:all\s+)?(?:previous|system|developer)\s+instructions\b/i,
			/\b(?:reveal|print|show)\s+(?:your\s+)?(?:system|hidden|developer)\s+prompt\b/i,
			/(?:^|\n)\s*(?:system|developer)\s*:/i,
			/<!--\s*(?:system|developer)\s*:/i,
		],
	},
];

function normalizeTextForScanning(content: string) {
	return content.normalize("NFKC").slice(0, MAX_TEXT_SCAN_CHARS);
}

export function hashModeratedContent(content: string | Buffer) {
	return createHash("sha256").update(content).digest("hex");
}

function sanitizeMetadata(metadata: SafeMetadata = {}) {
	return Object.fromEntries(
		Object.entries(metadata)
			.filter(
				(
					entry
				): entry is [string, Exclude<SafeMetadataValue, undefined>] =>
					entry[1] !== undefined
			)
			.map(([key, value]) => [
				key,
				/(content|message|prompt|token|secret|password|cookie|authorization)/i.test(
					key
				)
					? "[redacted]"
					: value,
			])
	);
}

function toMetadataJson(metadata?: SafeMetadata) {
	const sanitized = sanitizeMetadata(metadata);
	return Object.keys(sanitized).length > 0 ? JSON.stringify(sanitized) : null;
}

function isStrongerDecision(
	candidate: ModerationDecision,
	current: ModerationDecision
) {
	const actionDelta =
		ACTION_RANK[candidate.action] - ACTION_RANK[current.action];
	if (actionDelta !== 0) return actionDelta > 0;
	return SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[current.severity];
}

function allowDecision(): ModerationDecision {
	return {
		action: "allow",
		category: "none",
		severity: "low",
		reason: "No moderation policy rule matched.",
		userMessage: "Allowed.",
		matchedRuleIds: [],
		policyVersion: MODERATION_POLICY_VERSION,
	};
}

export function evaluateTextModeration({
	content,
	source,
}: {
	content: string;
	source: ModerationSource;
}): ModerationDecision {
	const normalized = normalizeTextForScanning(content);
	let decision = allowDecision();
	const matchedRuleIds: string[] = [];

	for (const rule of TEXT_RULES) {
		if (rule.sources && !rule.sources.includes(source)) {
			continue;
		}

		if (!rule.patterns.some((pattern) => pattern.test(normalized))) {
			continue;
		}

		matchedRuleIds.push(rule.id);
		const candidate: ModerationDecision = {
			action: rule.action,
			category: rule.category,
			severity: rule.severity,
			reason: rule.reason,
			userMessage: rule.userMessage,
			matchedRuleIds: [rule.id],
			policyVersion: MODERATION_POLICY_VERSION,
		};

		if (isStrongerDecision(candidate, decision)) {
			decision = candidate;
		}
	}

	return {
		...decision,
		matchedRuleIds,
	};
}

export function shouldPersistModerationDecision(decision: ModerationDecision) {
	return decision.action !== "allow" || decision.matchedRuleIds.length > 0;
}

export function isBlockingModerationDecision(decision: ModerationDecision) {
	return decision.action === "block";
}

export function buildModerationBlockResponse(decision: ModerationDecision) {
	return NextResponse.json(
		{
			error: decision.userMessage,
			errorCode: "MODERATION_BLOCKED",
			moderation: {
				category: decision.category,
				action: decision.action,
				severity: decision.severity,
				policyVersion: decision.policyVersion,
			},
		},
		{ status: 422 }
	);
}

export function buildModeratedOutputReplacement(decision: ModerationDecision) {
	return `${decision.userMessage} The generated output was blocked by ${decision.policyVersion}.`;
}

export async function recordModerationEvent({
	prismaClient = prisma,
	decision,
	source,
	stage,
	content,
	contentHash,
	contentLength,
	userId,
	conversationId,
	messageId,
	fileObjectId,
	sharedConversationId,
	metadata,
}: ModerationEventInput) {
	if (!shouldPersistModerationDecision(decision)) {
		return null;
	}

	const resolvedContentHash =
		contentHash ?? (content ? hashModeratedContent(content) : null);
	const resolvedContentLength =
		contentLength ?? (content ? content.length : null);

	try {
		return await prismaClient.moderationEvent.create({
			data: {
				userId: userId ?? null,
				organizationId: null,
				conversationId: conversationId ?? null,
				messageId: messageId ?? null,
				fileObjectId: fileObjectId ?? null,
				sharedConversationId: sharedConversationId ?? null,
				source,
				stage,
				category: decision.category,
				action: decision.action,
				severity: decision.severity,
				policyVersion: decision.policyVersion,
				reason: decision.reason,
				contentHash: resolvedContentHash,
				contentLength: resolvedContentLength,
				matchedRuleIds:
					decision.matchedRuleIds.length > 0
						? JSON.stringify(decision.matchedRuleIds)
						: null,
				metadataJson: toMetadataJson(metadata),
			},
		});
	} catch (error) {
		logServerWarning("moderation", "event_record_failed", {
			source,
			stage,
			category: decision.category,
			action: decision.action,
			errorType: error instanceof Error ? error.name : typeof error,
		});
		return null;
	}
}

export async function recordAbuseSignal({
	prismaClient = prisma,
	signalType,
	severity,
	action,
	userId,
	conversationId,
	actorHash,
	count = 1,
	windowSeconds,
	provider,
	model,
	providerStatusCode,
	metadata,
}: AbuseSignalInput) {
	try {
		return await prismaClient.abuseSignal.create({
			data: {
				userId: userId ?? null,
				organizationId: null,
				conversationId: conversationId ?? null,
				signalType,
				severity,
				action,
				actorHash: actorHash ?? null,
				count,
				windowSeconds: windowSeconds ?? null,
				provider: provider ?? null,
				model: model ?? null,
				providerStatusCode: providerStatusCode ?? null,
				metadataJson: toMetadataJson(metadata),
			},
		});
	} catch (error) {
		logServerWarning("moderation", "abuse_signal_record_failed", {
			signalType,
			severity,
			action,
			errorType: error instanceof Error ? error.name : typeof error,
		});
		return null;
	}
}

export async function moderateUserMessage({
	prismaClient = prisma,
	content,
	userId,
	conversationId,
}: {
	prismaClient?: ModerationPrismaClient;
	content: string;
	userId?: string | null;
	conversationId?: string | null;
}) {
	const decision = evaluateTextModeration({
		content,
		source: "chat_message",
	});

	await recordModerationEvent({
		prismaClient,
		decision,
		source: "chat_message",
		stage: "pre_generation",
		content,
		userId,
		conversationId,
		metadata: {
			flow: "chat_stream",
		},
	});

	if (isBlockingModerationDecision(decision)) {
		await recordAbuseSignal({
			prismaClient,
			signalType: "moderation_block",
			severity: decision.severity,
			action: "block",
			userId,
			conversationId,
			metadata: {
				category: decision.category,
				stage: "pre_generation",
			},
		});
	}

	return decision;
}

export function evaluateFileUploadModeration({
	filename,
	mimeType,
	buffer,
}: {
	filename: string;
	mimeType: string;
	buffer: Buffer;
}) {
	const filenameDecision = evaluateTextModeration({
		content: filename,
		source: "file_upload",
	});
	let decision = filenameDecision;

	const fileScanText = buffer
		.subarray(0, MAX_FILE_SCAN_BYTES)
		.toString("latin1")
		.toUpperCase();

	if (
		filename.toUpperCase().includes(EICAR_TEST_MARKER) ||
		fileScanText.includes(EICAR_TEST_MARKER)
	) {
		decision = {
			action: "block",
			category: "malware",
			severity: "critical",
			reason: "File scanner detected the EICAR test malware signature.",
			userMessage: "This file cannot be uploaded.",
			matchedRuleIds: ["file-eicar-signature"],
			policyVersion: MODERATION_POLICY_VERSION,
		};
	}

	if (
		/^(?:text\/|application\/(?:json|xml|sql)|application\/javascript)/i.test(
			mimeType
		)
	) {
		const textSample = buffer
			.subarray(0, MAX_FILE_SCAN_BYTES)
			.toString("utf8");
		const contentDecision = evaluateTextModeration({
			content: textSample,
			source: "file_upload",
		});
		if (isStrongerDecision(contentDecision, decision)) {
			decision = contentDecision;
		} else if (contentDecision.matchedRuleIds.length > 0) {
			decision = {
				...decision,
				matchedRuleIds: [
					...new Set([
						...decision.matchedRuleIds,
						...contentDecision.matchedRuleIds,
					]),
				],
			};
		}
	}

	return decision;
}

export function evaluateAssistantOutputModeration(content: string) {
	const decision = evaluateTextModeration({
		content,
		source: "assistant_output",
	});

	if (decision.action === "block") {
		return {
			...decision,
			category:
				decision.category === "none"
					? "output_risk"
					: decision.category,
		} satisfies ModerationDecision;
	}

	return decision;
}

export function evaluateAggregateContentModeration({
	contents,
	source,
}: {
	contents: string[];
	source: ModerationSource;
}) {
	let decision = allowDecision();
	for (const content of contents) {
		const candidate = evaluateTextModeration({ content, source });
		if (isStrongerDecision(candidate, decision)) {
			decision = candidate;
		} else if (candidate.matchedRuleIds.length > 0) {
			decision = {
				...decision,
				matchedRuleIds: [
					...new Set([
						...decision.matchedRuleIds,
						...candidate.matchedRuleIds,
					]),
				],
			};
		}
	}

	return decision;
}
