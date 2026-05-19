import { mistralClient } from '@/lib/models'
import { logServerError } from '@/lib/server-safe-log'
import type { ShareSummaryData } from '@/lib/share/types'

interface SummaryResult {
	summary: ShareSummaryData | null
	warning: string | null
}

const SUMMARY_MODEL = 'ministral-3b-latest'

function extractTextContent(content: unknown) {
	if (typeof content === 'string') return content.trim()
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === 'string') return part
				if (part && typeof part === 'object' && 'text' in part) {
					const text = (part as { text?: unknown }).text
					return typeof text === 'string' ? text : ''
				}
				return ''
			})
			.join('')
			.trim()
	}
	return ''
}

function extractJsonPayload(text: string) {
	const firstBrace = text.indexOf('{')
	const lastBrace = text.lastIndexOf('}')
	if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null

	try {
		return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as {
			overview?: unknown
			keyPoints?: unknown
		}
	} catch {
		return null
	}
}

export async function generateShareSummary(options: {
	messages: Array<{ role: 'user' | 'assistant'; content: string }>
	enabled: boolean
}): Promise<SummaryResult> {
	if (!options.enabled) {
		return { summary: null, warning: null }
	}

	if (!process.env.MISTRAL_API_KEY) {
		return {
			summary: null,
			warning: 'Summary generation is unavailable until MISTRAL_API_KEY is configured.',
		}
	}

	const conversation = options.messages
		.map((message) => {
			const role = message.role === 'user' ? 'User' : 'Assistant'
			return `${role}: ${message.content.slice(0, 2000)}`
		})
		.join('\n\n')
		.slice(0, 12000)

	if (!conversation.trim()) {
		return { summary: null, warning: null }
	}

	const prompt = [
		'Create a professional share summary for the selected conversation clips.',
		'Return strict JSON with this shape only:',
		'{"overview":"string","keyPoints":["string","string"]}',
		'Rules:',
		'- overview: 1 short paragraph, max 320 characters',
		'- keyPoints: 2 to 4 concise bullets',
		'- Do not mention masked values or invent missing context',
		'- Keep a professional, concise tone',
		'Conversation:',
		conversation,
	].join('\n')

	try {
		const response = await mistralClient.chat.complete({
			model: SUMMARY_MODEL,
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 280,
			temperature: 0.2,
		})

		const text = extractTextContent(response.choices?.[0]?.message?.content)
		const payload = extractJsonPayload(text)
		const overview =
			typeof payload?.overview === 'string' ? payload.overview.trim() : ''
		const keyPoints = Array.isArray(payload?.keyPoints)
			? payload.keyPoints.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean).slice(0, 4)
			: []

		if (!overview) {
			return {
				summary: null,
				warning: 'Summary generation did not return a valid result.',
			}
		}

		return {
			summary: {
				overview,
				keyPoints,
				model: SUMMARY_MODEL,
				generatedAt: new Date().toISOString(),
			},
			warning: null,
		}
	} catch (error) {
		logServerError('share/summary', 'generate_failed', error)
		return {
			summary: null,
			warning: 'Summary generation failed. You can still share the selected messages.',
		}
	}
}
