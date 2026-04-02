'use client'

import { useSettings } from '@/hooks/use-settings'
import {
	resolveEffectiveTheme,
	resolveThemeTokens,
	THEME_CSS_VARIABLES,
} from '@/lib/theme-engine'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

/**
 * ThemeApplier - Global theme synchronizer for both preset and custom themes.
 */
export function ThemeApplier() {
	const { settings, isLoaded } = useSettings()
	const { resolvedTheme, setTheme } = useTheme()

	useEffect(() => {
		if (!isLoaded) {
			return
		}

		setTheme(settings.theme)
	}, [isLoaded, settings.theme, setTheme])

	useEffect(() => {
		if (!isLoaded) {
			return
		}

		const root = document.documentElement
		const effectiveTheme = resolveEffectiveTheme(settings.theme, resolvedTheme)

		if (!effectiveTheme) {
			return
		}

		const tokens = resolveThemeTokens(settings, effectiveTheme)

		THEME_CSS_VARIABLES.forEach((variable) => {
			const value = tokens[variable]

			if (value) {
				root.style.setProperty(variable, value)
			} else {
				root.style.removeProperty(variable)
			}
		})
	}, [isLoaded, resolvedTheme, settings])

	return null
}
