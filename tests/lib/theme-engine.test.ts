import { hexToHsl, lightenColor } from '@/lib/color-utils'
import {
	buildCustomThemeFromColors,
	DEFAULT_THEME_SETTINGS,
	normalizeStoredThemeSettings,
	resolveThemePalette,
	resolveThemeTokens,
} from '@/lib/theme-engine'
import { describe, expect, it } from 'vitest'

describe('theme engine', () => {
	it('resolves the OG default theme with the canonical chat gradient in dark mode', () => {
		const palette = resolveThemePalette(DEFAULT_THEME_SETTINGS, 'dark')
		const tokens = resolveThemeTokens(DEFAULT_THEME_SETTINGS, 'dark')

		expect(palette.themeBackground).toBe('#0a0d11')
		expect(palette.themeChatBackground).toBe(
			'linear-gradient(180deg, #0A2727 0%, #0C1110 100%)'
		)
		expect(palette.themeCard).toBe('#11151a')
		expect(palette.themePrimary).toBe('#57FCFF')
		expect(palette.themeSecondary).toBe('#9B59B6')
		expect(tokens['--background']).toBe('#0a0d11')
		expect(tokens['--chat-background']).toBe(
			'linear-gradient(180deg, #0A2727 0%, #0C1110 100%)'
		)
		expect(tokens['--card']).toBe('#11151a')
		expect(tokens['--primary']).toBe('#57FCFF')
		expect(tokens['--secondary']).toBe('#9B59B6')
	})

	it('derives a light palette from the OG default theme', () => {
		const palette = resolveThemePalette(DEFAULT_THEME_SETTINGS, 'light')
		const backgroundHsl = hexToHsl(palette.themeBackground)
		const cardHsl = hexToHsl(palette.themeCard)
		const sidebarHsl = hexToHsl(palette.themeSidebar)
		const borderHsl = hexToHsl(palette.themeBorder)

		expect(palette.themePrimary).toBe(DEFAULT_THEME_SETTINGS.themePrimary)
		expect(palette.themeSecondary).toBe(DEFAULT_THEME_SETTINGS.themeSecondary)
		expect(palette.themeTertiary).toBe(DEFAULT_THEME_SETTINGS.themeTertiary)
		expect(palette.themeText).toBe('#0f172a')
		expect(palette.themeTextMuted).toBe('#475569')
		expect(palette.themeChatBackground).toBe(
			`linear-gradient(180deg, ${palette.themeBackground} 0%, ${palette.themeCard} 100%)`
		)
		expect(backgroundHsl).not.toBeNull()
		expect(backgroundHsl?.l).toBe(97)
		expect(cardHsl).not.toBeNull()
		expect(cardHsl?.l).toBe(99)
		expect(sidebarHsl).not.toBeNull()
		expect(sidebarHsl?.l).toBe(94)
		expect(borderHsl).not.toBeNull()
		expect(borderHsl?.l).toBe(84)
	})

	it('builds a custom theme from picked colors with full auto-theme behavior', () => {
		const customTheme = buildCustomThemeFromColors([
			'#123456',
			'#abcdef',
			'#fedcba',
		])

		expect(customTheme).toMatchObject({
			themeBackground: '#123456',
			themeChatBackground: '#123456',
			themeCard: lightenColor('#123456', 5),
			themePrimary: '#123456',
			themeSecondary: '#abcdef',
			themeTertiary: '#fedcba',
			activePreset: null,
		})
	})

	it('derives light mode from a custom palette while preserving accent colors', () => {
		const customTheme = buildCustomThemeFromColors([
			'#123456',
			'#abcdef',
			'#fedcba',
		])
		const palette = resolveThemePalette(
			{
				...DEFAULT_THEME_SETTINGS,
				...customTheme,
			},
			'light'
		)

		expect(palette.themePrimary).toBe('#123456')
		expect(palette.themeSecondary).toBe('#abcdef')
		expect(palette.themeTertiary).toBe('#fedcba')
		expect(hexToHsl(palette.themeBackground)?.l).toBe(97)
		expect(hexToHsl(palette.themeCard)?.l).toBe(99)
		expect(hexToHsl(palette.themeSidebar)?.l).toBe(94)
		expect(hexToHsl(palette.themeBorder)?.l).toBe(84)
		expect(palette.themeChatBackground).toBe(
			`linear-gradient(180deg, ${palette.themeBackground} 0%, ${palette.themeCard} 100%)`
		)
	})

	it('backfills missing themeChatBackground from a full preset', () => {
		const normalized = normalizeStoredThemeSettings({
			activePreset: 'default',
			themeBackground: '#0a0d11',
		})

		expect(normalized.themeChatBackground).toBe(
			'linear-gradient(180deg, #0A2727 0%, #0C1110 100%)'
		)
	})

	it.each([
		['midnight', '#000000', '#121212'],
		['slate', '#0f172a', '#1e293b'],
	])(
		'migrates legacy %s background presets into a single custom theme payload',
		(activePreset, expectedBackground, expectedCard) => {
			const normalized = normalizeStoredThemeSettings({
				activePreset,
				themePrimary: '#ff00ff',
				themeText: '#f0f4f8',
			})

			expect(normalized).toMatchObject({
				activePreset: null,
				themeBackground: expectedBackground,
				themeChatBackground: expectedBackground,
				themeCard: expectedCard,
				themePrimary: '#ff00ff',
				themeText: '#f0f4f8',
			})
		}
	)

	it('falls back to default theme colors before deriving light mode', () => {
		const palette = resolveThemePalette(
			{
				...DEFAULT_THEME_SETTINGS,
				themeBackground: 'invalid',
				themeCard: '',
				themeSidebar: 'nope',
				themePrimary: 'oops',
				themeSecondary: undefined,
				themeBorder: '---',
			},
			'light'
		)
		const defaultLightPalette = resolveThemePalette(DEFAULT_THEME_SETTINGS, 'light')

		expect(palette.themeBackground).toBe(defaultLightPalette.themeBackground)
		expect(palette.themeCard).toBe(defaultLightPalette.themeCard)
		expect(palette.themeSidebar).toBe(defaultLightPalette.themeSidebar)
		expect(palette.themeBorder).toBe(defaultLightPalette.themeBorder)
		expect(palette.themePrimary).toBe(DEFAULT_THEME_SETTINGS.themePrimary)
		expect(palette.themeSecondary).toBe(DEFAULT_THEME_SETTINGS.themeSecondary)
	})
})
