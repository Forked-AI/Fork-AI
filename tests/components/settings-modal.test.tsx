import type { Settings } from '@/hooks/use-settings'
import { DEFAULT_THEME_SETTINGS } from '@/lib/theme-engine'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockSettings: Settings
const mockUpdateSettings = vi.fn()
const mockResetToDefaults = vi.fn()

vi.mock('@/hooks/use-settings', () => ({
	useSettings: () => ({
		settings: mockSettings,
		updateSettings: mockUpdateSettings,
		resetToDefaults: mockResetToDefaults,
	}),
}))

vi.mock('next-themes', () => ({
	useTheme: () => ({
		resolvedTheme: 'dark',
	}),
}))

vi.mock('@/components/chat/theme-customization-modal', () => ({
	ThemeCustomizationModal: () => null,
}))

vi.mock('@/components/chat/chat-behavior-modal', () => ({
	ChatBehaviorModal: () => null,
}))

import { SettingsModal } from '@/components/chat/settings-modal'

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

describe('SettingsModal', () => {
	beforeEach(() => {
		mockSettings = createSettings()
		mockUpdateSettings.mockClear()
		mockResetToDefaults.mockClear()
	})

	it('uses appearance naming and keeps a single mode control in preferences', () => {
		render(
			<SettingsModal
				open
				onOpenChange={vi.fn()}
				compactMode={false}
				onCompactModeChange={vi.fn()}
			/>
		)

		expect(screen.getAllByText('Appearance').length).toBeGreaterThan(0)
		expect(screen.getByText('Customize Palette')).toBeInTheDocument()
		expect(screen.getByText('Appearance Mode')).toBeInTheDocument()
		expect(
			screen.getByText(
				/Light mode uses an auto-derived version of your palette\./
			)
		).toBeInTheDocument()
		expect(screen.queryByText('Theme Mode')).not.toBeInTheDocument()
		expect(screen.getAllByText('Appearance Mode')).toHaveLength(1)
	})
})
