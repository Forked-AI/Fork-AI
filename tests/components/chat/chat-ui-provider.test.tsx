import {
	ChatUIProvider,
	useChatUI,
} from '@/components/chat/chat-ui-provider'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'

function Consumer() {
	const {
		settingsOpen,
		generatingTitleIds,
		startTitleGeneration,
		finishTitleGeneration,
	} = useChatUI()

	return (
		<div>
			<div data-testid="settings-state">
				{settingsOpen ? 'open' : 'closed'}
			</div>
			<div data-testid="generating-ids">
				{Array.from(generatingTitleIds).join(',')}
			</div>
			<button onClick={() => startTitleGeneration('conv-1')} type="button">
				start
			</button>
			<button onClick={() => finishTitleGeneration('conv-1')} type="button">
				finish
			</button>
		</div>
	)
}

describe('ChatUIProvider', () => {
	it('opens settings on the Cmd/Ctrl + / shortcut', () => {
		render(
			<ChatUIProvider>
				<Consumer />
			</ChatUIProvider>
		)

		expect(screen.getByTestId('settings-state')).toHaveTextContent('closed')

		fireEvent.keyDown(window, { key: '/', metaKey: true })

		expect(screen.getByTestId('settings-state')).toHaveTextContent('open')
	})

	it('tracks title-generation ids', () => {
		render(
			<ChatUIProvider>
				<Consumer />
			</ChatUIProvider>
		)

		fireEvent.click(screen.getByRole('button', { name: 'start' }))
		expect(screen.getByTestId('generating-ids')).toHaveTextContent('conv-1')

		fireEvent.click(screen.getByRole('button', { name: 'finish' }))
		expect(screen.getByTestId('generating-ids')).toHaveTextContent('')
	})
})
