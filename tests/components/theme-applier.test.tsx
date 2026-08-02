import type { Settings } from '@/hooks/use-settings'
import {
	buildCustomThemeFromColors,
	DEFAULT_THEME_SETTINGS,
	resolveThemeTokens,
	THEME_CSS_VARIABLES,
} from '@/lib/theme-engine'
import { render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let mockSettings: Settings
let mockIsLoaded = true
let mockResolvedTheme: 'light' | 'dark' | undefined = 'dark'
const mockSetTheme = vi.fn()

vi.mock('@/hooks/use-settings', () => ({
	useSettings: () => ({ settings: mockSettings, isLoaded: mockIsLoaded }),
}))

vi.mock('next-themes', () => ({
	useTheme: () => ({
		resolvedTheme: mockResolvedTheme,
		setTheme: mockSetTheme,
	}),
}))

import { ThemeApplier } from '@/components/chat/theme-applier'

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

function clearThemeVariables() {
	THEME_CSS_VARIABLES.forEach((variable) => {
		document.documentElement.style.removeProperty(variable)
	})
}

describe('ThemeApplier', () => {
	beforeEach(() => {
		mockSetTheme.mockClear()
		mockIsLoaded = true
		mockResolvedTheme = 'dark'
		mockSettings = createSettings()
		clearThemeVariables()
	})

	afterEach(() => {
		clearThemeVariables()
	})

	it('applies the resolved dark theme tokens inline', async () => {
		const expectedTokens = resolveThemeTokens(mockSettings, 'dark')

		render(<ThemeApplier />)

		await waitFor(() => {
			expect(mockSetTheme).toHaveBeenCalledWith('dark')
			expect(
				document.documentElement.style.getPropertyValue('--chat-background')
			).toBe(expectedTokens['--chat-background'])
		})

		expect(document.documentElement.style.getPropertyValue('--secondary')).toBe(
			expectedTokens['--secondary']
		)
		expect(document.documentElement.style.getPropertyValue('--accent')).toBe(
			expectedTokens['--accent']
		)
	})

	it('applies derived inline theme tokens in light mode', async () => {
		document.documentElement.style.setProperty('--background', '#123456')
		document.documentElement.style.setProperty('--chat-background', '#654321')
		mockSettings = createSettings({ theme: 'light' })
		mockResolvedTheme = 'light'
		const expectedTokens = resolveThemeTokens(mockSettings, 'light')

		render(<ThemeApplier />)

		await waitFor(() => {
			expect(mockSetTheme).toHaveBeenCalledWith('light')
			expect(
				document.documentElement.style.getPropertyValue('--background')
			).toBe(expectedTokens['--background'])
		})

		expect(
			document.documentElement.style.getPropertyValue('--chat-background')
		).toBe(expectedTokens['--chat-background'])
		expect(document.documentElement.style.getPropertyValue('--secondary')).toBe(
			expectedTokens['--secondary']
		)
	})

	it('does nothing until settings finish loading', async () => {
		mockIsLoaded = false
		document.documentElement.style.setProperty('--background', '#123456')
		document.documentElement.style.setProperty('--chat-background', '#654321')
		const { rerender } = render(<ThemeApplier />)

		await waitFor(() => {
			expect(mockSetTheme).not.toHaveBeenCalled()
			expect(
				document.documentElement.style.getPropertyValue('--background')
			).toBe('#123456')
			expect(
				document.documentElement.style.getPropertyValue('--chat-background')
			).toBe('#654321')
		})

		mockIsLoaded = true
		rerender(<ThemeApplier />)

		await waitFor(() => {
			expect(mockSetTheme).toHaveBeenCalledWith('dark')
			expect(
				document.documentElement.style.getPropertyValue('--background')
			).toBe(resolveThemeTokens(mockSettings, 'dark')['--background'])
		})
	})

	it('waits for system theme resolution before applying tokens', async () => {
		mockSettings = createSettings({ theme: 'system' })
		mockResolvedTheme = undefined
		document.documentElement.style.setProperty('--background', '#654321')
		const { rerender } = render(<ThemeApplier />)

		await waitFor(() => {
			expect(mockSetTheme).toHaveBeenCalledWith('system')
			expect(
				document.documentElement.style.getPropertyValue('--background')
			).toBe('#654321')
		})

		mockResolvedTheme = 'light'
		rerender(<ThemeApplier />)

		await waitFor(() => {
			expect(
				document.documentElement.style.getPropertyValue('--background')
			).toBe(resolveThemeTokens(mockSettings, 'light')['--background'])
		})
	})

	it('updates chat background from preset to custom without a second overwrite layer', async () => {
		const { rerender } = render(<ThemeApplier />)

		await waitFor(() => {
			expect(
				document.documentElement.style.getPropertyValue('--chat-background')
			).toBe(DEFAULT_THEME_SETTINGS.themeChatBackground)
		})

		mockSettings = createSettings({
			...buildCustomThemeFromColors(['#123456', '#abcdef', '#fedcba']),
		})
		const expectedTokens = resolveThemeTokens(mockSettings, 'dark')
		rerender(<ThemeApplier />)

		await waitFor(() => {
			expect(
				document.documentElement.style.getPropertyValue('--chat-background')
			).toBe(expectedTokens['--chat-background'])
		})
	})

	it('publishes wave and noise settings as normalized global effect tokens', async () => {
		mockSettings = createSettings({ waveIntensity: 40, noiseAmount: 25 })

		render(<ThemeApplier />)

		await waitFor(() => {
			expect(
				document.documentElement.style.getPropertyValue('--wave-intensity')
			).toBe('0.4')
			expect(
				document.documentElement.style.getPropertyValue('--noise-amount')
			).toBe('0.25')
		})
	})
})
