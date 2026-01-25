'use client'

import { useEffect, useState } from 'react'

export interface Settings {
	compactMode: boolean
	theme: 'dark' | 'light'
	defaultModel: string
	messageTruncateLength: number
	sendKeybinding: 'enter' | 'ctrl-enter'
}

const DEFAULT_SETTINGS: Settings = {
	compactMode: false,
	theme: 'dark',
	defaultModel: 'gpt-4',
	messageTruncateLength: 300,
	sendKeybinding: 'enter',
}

export function useSettings() {
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		// Load from localStorage
		const stored = localStorage.getItem('fork-ai-settings')
		if (stored) {
			try {
				setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
			} catch (e) {
				console.error('Failed to parse settings:', e)
			}
		}
		setIsLoaded(true)
	}, [])

	const updateSettings = (partial: Partial<Settings>) => {
		const newSettings = { ...settings, ...partial }
		setSettings(newSettings)
		localStorage.setItem('fork-ai-settings', JSON.stringify(newSettings))
	}

	return {
		settings,
		updateSettings,
		isLoaded,
	}
}
