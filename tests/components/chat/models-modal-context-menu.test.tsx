import { Model, ModelsModal } from '@/components/chat/models-modal'
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const textCapabilities = {
	supportsText: true,
	supportsImages: false,
	supportsAudioInput: false,
	supportsAudioTranscription: false,
	supportsImageGeneration: false,
	supportsDocumentAttachments: true,
	supportsNativeWebSearch: false,
	supportsFunctionCalling: false,
	supportsProviderTools: false,
}

const models: Model[] = [
	{
		id: 'model-1',
		resolvedId: 'model-1',
		name: 'Alpha Model',
		description: 'Primary favorite model',
		provider: 'OpenAI',
		contextWindow: '128K',
		isFavorite: true,
		capabilities: textCapabilities,
	},
	{
		id: 'model-2',
		resolvedId: 'model-2',
		name: 'Beta Model',
		description: 'Favorite model',
		provider: 'Anthropic',
		contextWindow: '200K',
		isFavorite: true,
		capabilities: textCapabilities,
	},
	{
		id: 'model-3',
		resolvedId: 'model-3',
		name: 'Gamma Model',
		description: 'Favorite model',
		provider: 'Google',
		contextWindow: '1M',
		isFavorite: true,
		capabilities: textCapabilities,
	},
	{
		id: 'model-4',
		resolvedId: 'model-4',
		name: 'Delta Model',
		description: 'Favorite model',
		provider: 'Mistral',
		contextWindow: '128K',
		isFavorite: true,
		capabilities: textCapabilities,
	},
	{
		id: 'model-5',
		resolvedId: 'model-5',
		name: 'Epsilon Model',
		description: 'Non-favorite model',
		provider: 'DeepSeek',
		contextWindow: '64K',
		isFavorite: false,
		capabilities: textCapabilities,
	},
]

function getLastMenu() {
	return screen.getAllByRole('menu').at(-1)
}

function getMenuItemLabels(menu: HTMLElement) {
	return within(menu)
		.getAllByRole('menuitem')
		.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())
}

describe('ModelsModal context menus', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('shows the select-first right-click menu and keeps favorite disabled when the cap is reached', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSelectModel = vi.fn()
		const onToggleFavorite = vi.fn()

		render(
			<ModelsModal
				open
				onOpenChange={onOpenChange}
				models={models}
				onToggleFavorite={onToggleFavorite}
				onSelectModel={onSelectModel}
			/>
		)

		fireEvent.contextMenu(screen.getByText('Epsilon Model'))

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Select model',
			'Favorite',
			'View details',
		])
		expect(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Favorite' })
		).toHaveAttribute('data-disabled')

		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'View details' })
		)

		const dialogs = screen.getAllByRole('dialog')
		const detailsDialog = dialogs.at(-1)!

		expect(within(detailsDialog).getByText('Description')).toBeInTheDocument()
		expect(
			within(detailsDialog).getByText('Non-favorite model')
		).toBeInTheDocument()
		expect(onToggleFavorite).not.toHaveBeenCalled()
	})

	it('shows unfavorite for favorited models and lets the context menu select the model', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSelectModel = vi.fn()

		render(
			<ModelsModal
				open
				onOpenChange={onOpenChange}
				models={models}
				onToggleFavorite={vi.fn()}
				onSelectModel={onSelectModel}
			/>
		)

		fireEvent.contextMenu(screen.getByText('Alpha Model'))

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Select model',
			'Unfavorite',
			'View details',
		])

		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Select model' })
		)

		expect(onSelectModel).toHaveBeenCalledWith(models[0])
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})
})
