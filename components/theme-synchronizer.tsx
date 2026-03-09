'use client'

import { useSettings } from '@/hooks/use-settings'
import { BACKGROUND_PRESETS } from '@/lib/theme-presets'
import { useEffect } from 'react'

export function ThemeSynchronizer() {
	const { settings } = useSettings()

	// Apply custom colors to CSS variables
	useEffect(() => {
		// Only apply if we have custom colors or settings loaded
		if (!settings) return

		const root = document.documentElement

		// Apply theme mode class (handled by next-themes usually, but good to have)
		if (settings.theme === 'dark') {
			root.classList.add('dark')
		} else if (settings.theme === 'light') {
			root.classList.remove('dark')
		}
		// 'system' is handled by next-themes provider

		// Apply background settings
		// Only apply BACKGROUND_PRESETS if the user has NOT set custom theme colors
		// (i.e., activePreset is a known preset ID, not null).
		// When activePreset is null, ThemeApplier handles the custom colors.
		const isDark =
			settings.theme === 'dark' ||
			(settings.theme === 'system' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches)

		if (isDark && settings.activePreset) {
			// User is using a named preset — look up background preset by activePreset ID
			const preset = BACKGROUND_PRESETS.find(
				(p) => p.id === settings.activePreset
			)

			if (preset) {
				root.style.setProperty('--background', preset.value)
				root.style.setProperty('--card', preset.cardValue)
				root.style.setProperty('--sidebar', preset.sidebarValue)
				root.style.setProperty(
					'--chat-background',
					preset.style || preset.value
				)
			}
		} else if (!isDark) {
			// Light mode — remove custom overrides so next-themes handles it
			root.style.removeProperty('--background')
			root.style.removeProperty('--card')
			root.style.removeProperty('--sidebar')
			root.style.removeProperty('--chat-background')
		}
		// When activePreset is null (custom colors), ThemeApplier sets all CSS vars
	}, [
		settings.theme,
		settings.themeBackground,
		settings.activePreset,
	])

	return null // This component renders nothing
}
