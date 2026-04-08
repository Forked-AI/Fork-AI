export const FULL_MESSAGE_REDACTION = '[Message redacted by author]' as const

export interface MessageSnapshot {
	id: string
	role: 'user' | 'assistant'
	content: string
	model?: string
	createdAt: string
	orderIndex: number
}

export type ShareMaskKind =
	| 'email'
	| 'phone'
	| 'long_number'
	| 'secret'
	| 'wallet'

export interface ShareMaskFinding {
	id: string
	kind: ShareMaskKind
	label: string
	start: number
	end: number
	original: string
	replacement: string
}

export interface ShareDraftMessage {
	id: string
	role: 'user' | 'assistant'
	model?: string
	createdAt: string
	orderIndex: number
	originalContent: string
	maskedContent: string
	findings: ShareMaskFinding[]
	approvedFindingIds: string[]
}

export interface ShareSummaryData {
	overview: string
	keyPoints: string[]
	model: string
	generatedAt: string
	edited?: boolean
}

export interface ShareMaskingData {
	enabled: boolean
	findingsByMessageId: Record<string, ShareMaskFinding[]>
	approvedFindingIdsByMessageId: Record<string, string[]>
	redactedMessageIds: string[]
}

export interface SharePreviewResponse {
	messages: ShareDraftMessage[]
	summary: ShareSummaryData | null
	summaryWarning: string | null
}

export interface ShareMessageSelectionInput {
	id: string
	approvedFindingIds: string[]
	redactWholeMessage: boolean
}
