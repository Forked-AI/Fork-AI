'use client'

import { useSettings } from '@/hooks/use-settings'
import { getOptimalTextColor } from '@/lib/theme-presets'
import { useEffect } from 'react'

/**
 * ThemeApplier - Always-mounted component that applies theme CSS variables.
 * Must be rendered in a layout that's always visible (e.g., chat layout),
 * NOT inside a modal that only mounts when opened.
 */
export function ThemeApplier() {
	const { settings } = useSettings()

	useEffect(() => {
		const root = document.documentElement
		const isCustom = !settings.activePreset // null = user picked custom colors
        console.log('Applying theme with settings activePreset:', settings.activePreset, 'isCustom:', isCustom)

		// Apply custom --theme-* variables (always, for reference)
		root.style.setProperty('--theme-background', settings.themeBackground || '#0a0d11')
		root.style.setProperty('--theme-card', settings.themeCard || '#0f1116')
		root.style.setProperty('--theme-sidebar', settings.themeSidebar || '#0d1015')
		root.style.setProperty('--theme-primary', settings.themePrimary || '#57FCFF')
		root.style.setProperty('--theme-secondary', settings.themeSecondary || '#B8A8FF')
		root.style.setProperty('--theme-tertiary', settings.themeTertiary || '#FFCA57')
		root.style.setProperty('--theme-border', settings.themeBorder || '#2a2f38')
		root.style.setProperty('--theme-text', settings.themeText || '#FFFFFF')
		root.style.setProperty('--theme-text-muted', settings.themeTextMuted || '#a0a0a0')

		// Apply background/card/sidebar/chat-background ALWAYS
		// The settings already contain the correct values from either:
		// 1. A theme preset (e.g. "lavender") - applied by theme-customization-modal
		// 2. Custom colors from ZenColorPicker - applied by handleThemeColorsChange
		// ThemeSynchronizer only handles legacy BACKGROUND_PRESETS (4 simple backgrounds)
		const bg = settings.themeBackground || '#0a0d11'
		root.style.setProperty('--background', bg)
		root.style.setProperty('--chat-background', bg)
		root.style.setProperty('--card', settings.themeCard || '#11151a')
		root.style.setProperty('--sidebar', settings.themeSidebar || '#0a0d11')
		root.style.setProperty('--border', settings.themeBorder || '#242b36')
		root.style.setProperty('--sidebar-border', settings.themeBorder || '#242b36')

		// Text & accent colors — always apply
		root.style.setProperty('--foreground', settings.themeText || '#f0f4f8')
		root.style.setProperty('--card-foreground', settings.themeText || '#f0f4f8')
		root.style.setProperty('--muted-foreground', settings.themeTextMuted || '#94a3b8')
		root.style.setProperty('--sidebar-foreground', settings.themeText || '#f0f4f8')
		root.style.setProperty('--primary', settings.themePrimary || '#57FCFF')
		root.style.setProperty('--ring', settings.themePrimary || '#57FCFF')

		// Calculate appropriate foreground color for primary
		const primaryForeground = getOptimalTextColor(settings.themePrimary || '#57FCFF')
		root.style.setProperty('--primary-foreground', primaryForeground)

		// Apply wave and noise intensities
		root.style.setProperty('--wave-intensity', `${settings.waveIntensity / 100}`)
		root.style.setProperty('--noise-amount', `${settings.noiseAmount / 100}`)
	}, [
		settings.activePreset,
		settings.themeBackground,
		settings.themeCard,
		settings.themeSidebar,
		settings.themePrimary,
		settings.themeSecondary,
		settings.themeTertiary,
		settings.themeBorder,
		settings.themeText,
		settings.themeTextMuted,
		settings.waveIntensity,
		settings.noiseAmount,
	])

	// This component renders nothing - it only applies CSS variables
	return null
}
