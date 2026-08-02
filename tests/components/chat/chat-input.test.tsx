import { ChatInput } from '@/components/chat/chat-input'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/use-settings', () => ({
	useSettings: () => ({
		settings: {
			sendKeybinding: 'enter',
		},
	}),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onSelect,
	}: {
		children: React.ReactNode
		onSelect?: () => void
	}) => <button onClick={onSelect}>{children}</button>,
	DropdownMenuSeparator: () => <div />,
}))

vi.mock('@/components/chat/models-modal', () => ({
	ModelsModal: () => null,
}))

vi.mock('@/components/chat/skill-picker', () => ({
	SkillPicker: () => null,
}))

describe('ChatInput', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('debounces rapid repeated send actions', async () => {
		const user = userEvent.setup()
		const onSendMessage = vi.fn().mockResolvedValue(undefined)

		render(<ChatInput onSendMessage={onSendMessage} />)

		const textbox = screen.getByRole('textbox')
		const sendButton = screen.getByRole('button', { name: /send message/i })

		await user.type(textbox, 'First message')
		await user.click(sendButton)
		expect(onSendMessage).toHaveBeenCalledTimes(1)
		expect(onSendMessage).toHaveBeenLastCalledWith(
			'First message',
			'auto',
			undefined,
			[],
			[]
		)

		await user.type(textbox, 'Second message')
		await user.click(sendButton)
		expect(onSendMessage).toHaveBeenCalledTimes(1)

		await new Promise((resolve) => setTimeout(resolve, 550))
		await user.clear(textbox)
		await user.type(textbox, 'Third message')
		await user.click(sendButton)
		expect(onSendMessage).toHaveBeenCalledTimes(2)
		expect(onSendMessage).toHaveBeenLastCalledWith(
			'Third message',
			'auto',
			undefined,
			[],
			[]
		)
	})

	it('inserts selected reply quotes above an existing draft', async () => {
		const user = userEvent.setup()
		const onSendMessage = vi.fn().mockResolvedValue(undefined)
		const { rerender } = render(<ChatInput onSendMessage={onSendMessage} />)

		const textbox = screen.getByRole('textbox')
		await user.type(textbox, 'Please explain this')

		rerender(
			<ChatInput
				onSendMessage={onSendMessage}
				quoteInsertion={{
					id: 'quote-1',
					text: 'first line\nsecond line',
				}}
			/>
		)

		expect(textbox).toHaveValue(
			'> first line\n> second line\n\nPlease explain this'
		)
		expect(textbox).toHaveFocus()
	})

	it('inserts context chat drafts with removable source chips', async () => {
		const user = userEvent.setup()
		const onSendMessage = vi.fn().mockResolvedValue(undefined)

		render(
			<ChatInput
				onSendMessage={onSendMessage}
				contextDraftInsertion={{
					id: 'context-draft-1',
					text: 'Context source: Project plan\n\n> User: Launch plan\n\nUsing the context above, ',
					sources: [{ id: 'conversation-1', title: 'Project plan' }],
				}}
			/>
		)

		const textbox = screen.getByRole('textbox')

		expect(screen.getByText('Context sources')).toBeInTheDocument()
		expect(screen.getByText('Project plan')).toBeInTheDocument()
		expect(textbox).toHaveValue(
			'Context source: Project plan\n\n> User: Launch plan\n\nUsing the context above, \n\n'
		)

		await user.click(
			screen.getByRole('button', {
				name: 'Remove context from Project plan',
			})
		)

		expect(screen.queryByText('Context sources')).not.toBeInTheDocument()
		expect(textbox).toHaveValue('')
	})

	it('sends the web search tool when toggled for a message', async () => {
		const user = userEvent.setup()
		const onSendMessage = vi.fn().mockResolvedValue(undefined)

		render(<ChatInput onSendMessage={onSendMessage} />)

		await user.type(screen.getByRole('textbox'), 'Find latest model info')
		await user.click(screen.getByRole('button', { name: /toggle web search/i }))
		await user.click(screen.getByRole('button', { name: /send message/i }))

		expect(onSendMessage).toHaveBeenCalledWith(
			'Find latest model info',
			'auto',
			undefined,
			[],
			['web.search']
		)
	})

	it('uploads pasted image files and sends them as vision attachments', async () => {
		const user = userEvent.setup()
		const onSendMessage = vi.fn().mockResolvedValue(undefined)
		const createObjectURL = vi.fn(() => 'blob:pasted-image')
		const revokeObjectURL = vi.fn()
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectURL,
		})
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: revokeObjectURL,
		})
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					attachment: {
						fileObjectId: 'file-image-1',
						filename: 'clipboard.png',
						kind: 'image',
						fileKind: 'image',
						purpose: 'vision_image',
						mimeType: 'image/png',
						sizeBytes: 8,
						contentUrl: '/api/attachments/file-image-1/content',
						status: 'ready',
						chunkCount: 0,
						errorCode: null,
					},
				}),
				{
					status: 201,
					headers: { 'Content-Type': 'application/json' },
				}
			)
		)
		vi.stubGlobal('fetch', fetchMock)

		render(<ChatInput onSendMessage={onSendMessage} />)

		const textbox = screen.getByRole('textbox')
		const image = new File(['pngbytes'], 'clipboard.png', {
			type: 'image/png',
		})
		fireEvent.paste(textbox, {
			clipboardData: {
				files: [image],
				items: [
					{
						kind: 'file',
						getAsFile: () => image,
					},
				],
			},
		})

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/attachments',
				expect.objectContaining({
					method: 'POST',
					body: expect.any(FormData),
				})
			)
		})
		await screen.findByText('Vision')

		await user.type(textbox, 'Describe it')
		await user.click(screen.getByRole('button', { name: /send message/i }))

		expect(onSendMessage).toHaveBeenCalledWith(
			'Describe it',
			'auto',
			[
				expect.objectContaining({
					fileObjectId: 'file-image-1',
					kind: 'image',
					promptUse: 'vision',
				}),
			],
			[],
			[]
		)
		expect(createObjectURL).toHaveBeenCalledWith(image)
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:pasted-image')
	})
})
