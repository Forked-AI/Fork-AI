import {
	applyApprovedShareMasking,
	buildFinalShareContent,
	buildShareDraftMessages,
	detectShareMaskFindings,
	FULL_MESSAGE_REDACTION,
} from '@/lib/share/masking'
import { describe, expect, it } from 'vitest'

describe('share masking helpers', () => {
	it('detects and masks common sensitive values', () => {
		const content =
			'Contact jane@example.com or +1 (555) 123-4567. Wallet 0x1234567890abcdef1234567890abcdef12345678. Token sk-1234567890abcdefghijklmnop.'

		const findings = detectShareMaskFindings(content)
		const masked = applyApprovedShareMasking(
			content,
			findings,
			findings.map((finding) => finding.id)
		)

		expect(findings.map((finding) => finding.kind)).toEqual(
			expect.arrayContaining(['email', 'phone', 'wallet', 'secret'])
		)
		expect(masked).toContain('[email redacted]')
		expect(masked).toContain('[phone redacted]')
		expect(masked).toContain('[wallet redacted]')
		expect(masked).toContain('[token redacted]')
		expect(masked).not.toContain('jane@example.com')
		expect(masked).not.toContain('0x1234567890abcdef1234567890abcdef12345678')
	})

	it('preserves selective approvals per message', () => {
		const content = 'Email jane@example.com and wallet 0x1234567890abcdef1234567890abcdef12345678'
		const findings = detectShareMaskFindings(content)
		const emailFinding = findings.find((finding) => finding.kind === 'email')

		const [draft] = buildShareDraftMessages(
			[
				{
					id: 'message-1',
					role: 'assistant',
					content,
					model: 'mistral-large-latest',
					createdAt: new Date('2026-01-01T00:00:00.000Z'),
				},
			],
			{
				autoMaskPII: true,
				approvedFindingIdsByMessageId: {
					'message-1': emailFinding ? [emailFinding.id] : [],
				},
			}
		)

		expect(draft.maskedContent).toContain('[email redacted]')
		expect(draft.maskedContent).toContain('0x1234567890abcdef1234567890abcdef12345678')
	})

	it('supports full-message redaction as the final safeguard', () => {
		const findings = detectShareMaskFindings('Email jane@example.com')

		expect(
			buildFinalShareContent({
				originalContent: 'Email jane@example.com',
				findings,
				approvedFindingIds: findings.map((finding) => finding.id),
				redactWholeMessage: true,
			})
		).toBe(FULL_MESSAGE_REDACTION)
	})
})
