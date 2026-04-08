import {
	buildFinalShareContent,
	buildShareDraftMessages,
	detectShareMaskFindings,
} from '@/lib/share/masking'
import { generateShareSummary } from '@/lib/share/summary'
import type {
	MessageSnapshot,
	ShareMaskingData,
	ShareMessageSelectionInput,
	SharePreviewResponse,
	ShareSummaryData,
} from '@/lib/share/types'

type ShareableMessage = {
	id: string
	role: 'user' | 'assistant'
	content: string
	model?: string | null
	createdAt: Date
}

export async function buildSharePreview(options: {
	messages: ShareableMessage[]
	autoMaskPII: boolean
	generateSummary: boolean
	approvedFindingIdsByMessageId?: Record<string, string[]>
	redactedMessageIds?: string[]
}): Promise<SharePreviewResponse> {
	const draftMessages = buildShareDraftMessages(options.messages, {
		autoMaskPII: options.autoMaskPII,
		approvedFindingIdsByMessageId: options.approvedFindingIdsByMessageId,
		redactedMessageIds: new Set(options.redactedMessageIds ?? []),
	})

	const { summary, warning } = await generateShareSummary({
		enabled: options.generateSummary,
		messages: draftMessages.map((message) => ({
			role: message.role,
			content: message.maskedContent,
		})),
	})

	return {
		messages: draftMessages,
		summary,
		summaryWarning: warning,
	}
}

export function buildSharePersistencePayload(options: {
	messages: ShareableMessage[]
	messageSelections: ShareMessageSelectionInput[]
	autoMaskPII: boolean
	summary: ShareSummaryData | null
}) {
	const selectionMap = new Map(
		options.messageSelections.map((selection) => [selection.id, selection])
	)

	const selectedMessages = options.messages.filter((message) =>
		selectionMap.has(message.id)
	)

	const snapshots: MessageSnapshot[] = selectedMessages.map((message, index) => {
		const selection = selectionMap.get(message.id)
		if (!selection) {
			throw new Error(`Missing message selection for ${message.id}`)
		}

		const findings = options.autoMaskPII
			? detectShareMaskFindings(message.content)
			: []
		const content = buildFinalShareContent({
			originalContent: message.content,
			findings,
			approvedFindingIds: selection.approvedFindingIds,
			redactWholeMessage: selection.redactWholeMessage,
		})

		return {
			id: message.id,
			role: message.role,
			content,
			model: message.model ?? undefined,
			createdAt: message.createdAt.toISOString(),
			orderIndex: index,
		}
	})

	const maskingData: ShareMaskingData = {
		enabled: options.autoMaskPII,
		findingsByMessageId: Object.fromEntries(
			selectedMessages.map((message) => [
				message.id,
				options.autoMaskPII ? detectShareMaskFindings(message.content) : [],
			])
		),
		approvedFindingIdsByMessageId: Object.fromEntries(
			options.messageSelections.map((selection) => [
				selection.id,
				selection.approvedFindingIds,
			])
		),
		redactedMessageIds: options.messageSelections
			.filter((selection) => selection.redactWholeMessage)
			.map((selection) => selection.id),
	}

	return {
		selectedMessageIds: selectedMessages.map((message) => message.id),
		snapshots,
		summary: options.summary,
		maskingData,
	}
}
