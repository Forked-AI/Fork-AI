import { ForkPlaygroundModal } from '@/components/chat/fork-playground-modal'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

describe('ForkPlaygroundModal', () => {
	beforeEach(() => {
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('shows a no active conversation empty state without fetching', () => {
		render(
			<ForkPlaygroundModal
				open
				onOpenChange={vi.fn()}
				conversationId={null}
				onOpenForkView={vi.fn()}
			/>
		)

		expect(screen.getByText('No active conversation')).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('reports zero fork paths and branch points for a linear tree', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				messages: [
					{
						id: 'message-1',
						role: 'user',
						content: 'Start here',
						parentMessageId: null,
					},
					{
						id: 'message-2',
						role: 'assistant',
						content: 'Continue linearly',
						parentMessageId: 'message-1',
					},
				],
				tree: {
					null: ['message-1'],
					'message-1': ['message-2'],
				},
			}),
		})

		render(
			<ForkPlaygroundModal
				open
				onOpenChange={vi.fn()}
				conversationId="conversation-1"
				conversationTitle="Linear chat"
				onOpenForkView={vi.fn()}
			/>
		)

		await waitFor(() => {
			expect(screen.getByTestId('fork-playground-message-count')).toHaveTextContent(
				'2'
			)
		})
		expect(
			screen.getByTestId('fork-playground-fork-path-count')
		).toHaveTextContent('0')
		expect(
			screen.getByTestId('fork-playground-branch-point-count')
		).toHaveTextContent('0')
		expect(
			screen.getByText(
				'This chat does not have sibling branches yet. Create an alternative from any message to compare paths here.'
			)
		).toBeInTheDocument()
	})

	it('reports sibling branch points and previews the branching message', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				messages: [
					{
						id: 'message-1',
						role: 'user',
						content: 'Which launch path should we take?',
						parentMessageId: null,
					},
					{
						id: 'message-2',
						role: 'assistant',
						content: 'Take the conservative path.',
						parentMessageId: 'message-1',
					},
					{
						id: 'message-3',
						role: 'assistant',
						content: 'Take the aggressive path.',
						parentMessageId: 'message-1',
					},
				],
				tree: {
					null: ['message-1'],
					'message-1': ['message-2', 'message-3'],
				},
			}),
		})

		render(
			<ForkPlaygroundModal
				open
				onOpenChange={vi.fn()}
				conversationId="conversation-1"
				conversationTitle="Branched chat"
				onOpenForkView={vi.fn()}
			/>
		)

		await waitFor(() => {
			expect(
				screen.getByTestId('fork-playground-fork-path-count')
			).toHaveTextContent('2')
		})
		expect(
			screen.getByTestId('fork-playground-branch-point-count')
		).toHaveTextContent('1')
		expect(
			screen.getByText('Which launch path should we take?')
		).toBeInTheDocument()
		expect(screen.getByText('2 paths')).toBeInTheDocument()
	})

	it('shows an error state when branch loading fails', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			json: async () => ({ error: 'Conversation not found' }),
		})

		render(
			<ForkPlaygroundModal
				open
				onOpenChange={vi.fn()}
				conversationId="missing-conversation"
				onOpenForkView={vi.fn()}
			/>
		)

		expect(await screen.findByText('Conversation not found')).toBeInTheDocument()
	})
})
