import {
	FULL_MESSAGE_REDACTION,
	type ShareDraftMessage,
	type ShareMaskFinding,
	type ShareMaskKind,
} from '@/lib/share/types'

const MASK_PATTERNS: Array<{
	kind: ShareMaskKind
	label: string
	regex: RegExp
	replacement: string
}> = [
	{
		kind: 'secret',
		label: 'Sensitive token',
		regex: /\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,})\b/g,
		replacement: '[token redacted]',
	},
	{
		kind: 'email',
		label: 'Email address',
		regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
		replacement: '[email redacted]',
	},
	{
		kind: 'wallet',
		label: 'Wallet address',
		regex: /\b0x[a-fA-F0-9]{40}\b/g,
		replacement: '[wallet redacted]',
	},
	{
		kind: 'phone',
		label: 'Phone number',
		regex: /\b(?:\+?\d[\d().\s-]{7,}\d)\b/g,
		replacement: '[phone redacted]',
	},
	{
		kind: 'long_number',
		label: 'Long number',
		regex: /\b\d{12,19}\b/g,
		replacement: '[number redacted]',
	},
]

function buildFindingId(kind: ShareMaskKind, start: number, end: number) {
	return `${kind}:${start}:${end}`
}

function normalizeFindings(findings: ShareMaskFinding[]) {
	return findings
		.sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start
			return b.end - a.end
		})
		.reduce<ShareMaskFinding[]>((acc, finding) => {
			const prev = acc[acc.length - 1]
			if (prev && finding.start < prev.end) {
				return acc
			}
			acc.push(finding)
			return acc
		}, [])
}

export function detectShareMaskFindings(content: string): ShareMaskFinding[] {
	if (!content) return []

	const findings: ShareMaskFinding[] = []
	for (const pattern of MASK_PATTERNS) {
		for (const match of content.matchAll(pattern.regex)) {
			const value = match[0]
			const start = match.index ?? -1
			if (start < 0) continue
			const end = start + value.length

			findings.push({
				id: buildFindingId(pattern.kind, start, end),
				kind: pattern.kind,
				label: pattern.label,
				start,
				end,
				original: value,
				replacement: pattern.replacement,
			})
		}
	}

	return normalizeFindings(findings)
}

export function applyApprovedShareMasking(
	content: string,
	findings: ShareMaskFinding[],
	approvedFindingIds: string[]
) {
	if (!content) return content
	if (!findings.length || !approvedFindingIds.length) return content

	const approved = new Set(approvedFindingIds)
	const chunks: string[] = []
	let cursor = 0

	for (const finding of findings) {
		if (!approved.has(finding.id)) continue
		if (finding.start < cursor) continue

		chunks.push(content.slice(cursor, finding.start))
		chunks.push(finding.replacement)
		cursor = finding.end
	}

	chunks.push(content.slice(cursor))
	return chunks.join('')
}

export function buildShareDraftMessages(
	messages: Array<{
		id: string
		role: 'user' | 'assistant'
		content: string
		model?: string | null
		createdAt: Date
	}>,
	options: {
		autoMaskPII: boolean
		approvedFindingIdsByMessageId?: Record<string, string[]>
		redactedMessageIds?: Set<string>
	}
): ShareDraftMessage[] {
	return messages.map((message, index) => {
		const findings = options.autoMaskPII
			? detectShareMaskFindings(message.content)
			: []
		const approvedFindingIds =
			options.approvedFindingIdsByMessageId?.[message.id] ?? findings.map((finding) => finding.id)
		const maskedContent = options.redactedMessageIds?.has(message.id)
			? FULL_MESSAGE_REDACTION
			: applyApprovedShareMasking(message.content, findings, approvedFindingIds)

		return {
			id: message.id,
			role: message.role,
			model: message.model ?? undefined,
			createdAt: message.createdAt.toISOString(),
			orderIndex: index,
			originalContent: message.content,
			maskedContent,
			findings,
			approvedFindingIds,
		}
	})
}

export function buildFinalShareContent(options: {
	originalContent: string
	findings: ShareMaskFinding[]
	approvedFindingIds: string[]
	redactWholeMessage: boolean
}) {
	if (options.redactWholeMessage) return FULL_MESSAGE_REDACTION

	return applyApprovedShareMasking(
		options.originalContent,
		options.findings,
		options.approvedFindingIds
	)
}

export { FULL_MESSAGE_REDACTION }
