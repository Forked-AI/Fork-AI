import type { Settings } from '@/hooks/use-settings'
import { DEFAULT_THEME_SETTINGS } from '@/lib/theme-engine'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-themes', () => ({
	useTheme: () => ({
		resolvedTheme: 'dark',
	}),
}))

import { ThemeCustomizationModal } from '@/components/chat/theme-customization-modal'

function createSettings(overrides: Partial<Settings> = {}): Settings {
	return {
		compactMode: false,
		theme: 'dark',
		defaultModel: 'gpt-4',
		messageTruncateLength: 300,
		sendKeybinding: 'enter',
		recentChatSwitcherShortcut: 'Alt+Q',
		...DEFAULT_THEME_SETTINGS,
		strictContrastMode: false,
		reducedEffects: false,
		chatTemperature: 0.7,
		systemPrompt: '',
		enabledFeatures: {
			showMessageTimestamps: false,
			enableMarkdownPreview: true,
			autoSaveConversations: true,
			showTokenCount: false,
			enableSoundEffects: false,
		},
		lastModifiedFields: {},
		...overrides,
	}
}

describe('ThemeCustomizationModal', () => {
	let settings: Settings

	beforeEach(() => {
		settings = createSettings()
	})

	it('uses palette naming and does not render a duplicate appearance mode control', () => {
		render(
			<ThemeCustomizationModal
				open
				onOpenChange={vi.fn()}
				settings={settings}
				updateSettings={vi.fn()}
			/>
		)

		expect(screen.getByText('Palette Customization')).toBeInTheDocument()
		expect(screen.getByText('Preset Palettes')).toBeInTheDocument()
		expect(screen.getByText('Custom Palette Colors')).toBeInTheDocument()
		expect(screen.queryByText('Theme Mode')).not.toBeInTheDocument()
		expect(screen.queryByTitle('Light mode')).not.toBeInTheDocument()
		expect(screen.queryByTitle('Dark mode')).not.toBeInTheDocument()
		expect(screen.queryByTitle('System')).not.toBeInTheDocument()
		expect(
			screen.queryByText('Light mode is auto-derived from your saved palette.')
		).not.toBeInTheDocument()
	})

	it('blocks an artistic preset when strict contrast mode is enabled', () => {
		const updateSettings = vi.fn()
		settings = createSettings({ strictContrastMode: true })

		render(
			<ThemeCustomizationModal
				open
				onOpenChange={vi.fn()}
				settings={settings}
				updateSettings={updateSettings}
			/>
		)

		fireEvent.click(screen.getByText('Aurora'))

		expect(updateSettings).not.toHaveBeenCalled()
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Strict Contrast Mode blocked that palette'
		)
	})

	it('applies a compliant preset and reports it as saved', () => {
		const updateSettings = vi.fn()
		const showSavedIndicator = vi.fn()

		render(
			<ThemeCustomizationModal
				open
				onOpenChange={vi.fn()}
				settings={settings}
				updateSettings={updateSettings}
				showSavedIndicator={showSavedIndicator}
			/>
		)

		fireEvent.click(screen.getByText('Ocean'))

		expect(updateSettings).toHaveBeenCalledWith(
			expect.objectContaining({ activePreset: 'ocean' })
		)
		expect(showSavedIndicator).toHaveBeenCalled()
	})
})
