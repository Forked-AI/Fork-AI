"use client";

import {
	DEFAULT_THEME_SETTINGS,
	normalizeStoredThemeSettings,
	type ThemeColorPosition,
} from "@/lib/theme-engine";
import { useEffect, useState } from "react";

export interface EnabledFeatures {
	showMessageTimestamps: boolean;
	enableMarkdownPreview: boolean;
	autoSaveConversations: boolean;
	showTokenCount: boolean;
	enableSoundEffects: boolean;
}

export interface Settings {
	compactMode: boolean;
	theme: "dark" | "light" | "system";
	defaultModel: string;
	messageTruncateLength: number;
	sendKeybinding: "enter" | "ctrl-enter";
	recentChatSwitcherShortcut: string;
	// Theme customization - complete theme package
	themeBackground: string; // Main background
	themeChatBackground: string; // Visible chat background (supports gradients)
	themeCard: string; // Card background
	themeSidebar: string; // Sidebar background
	themePrimary: string; // Primary accent
	themeSecondary: string; // Secondary accent
	themeTertiary: string; // Tertiary accent
	themeBorder: string; // Border color
	themeText: string; // Auto-calculated text color
	themeTextMuted: string; // Auto-calculated muted text
	themeColors: string[]; // Active custom color stops (1-3)
	themeColorPositions: ThemeColorPosition[]; // Persisted gradient stop positions
	waveIntensity: number; // 0-100
	noiseAmount: number; // 0-100
	activePreset: string | null; // preset ID or null for custom
	strictContrastMode: boolean;
	reducedEffects: boolean;
	// Chat behavior
	chatTemperature: number; // 0-2
	systemPrompt: string;
	// Feature toggles
	enabledFeatures: EnabledFeatures;
	// Sync tracking
	lastModifiedFields: Record<string, number>; // field -> timestamp
}

const DEFAULT_SETTINGS: Settings = {
	compactMode: false,
	theme: "dark",
	defaultModel: "gpt-4",
	messageTruncateLength: 300,
	sendKeybinding: "enter",
	recentChatSwitcherShortcut: "Alt+Q",
	// Theme customization defaults (Default preset)
	...DEFAULT_THEME_SETTINGS,
	strictContrastMode: false,
	reducedEffects: false,
	// Chat behavior defaults
	chatTemperature: 0.7,
	systemPrompt: "",
	// Feature toggles defaults
	enabledFeatures: {
		showMessageTimestamps: false,
		enableMarkdownPreview: true,
		autoSaveConversations: true,
		showTokenCount: false,
		enableSoundEffects: false,
	},
	// Sync tracking
	lastModifiedFields: {},
};

export function useSettings() {
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		// Load from localStorage
		const loadSettings = () => {
			const stored = localStorage.getItem("fork-ai-settings");
			if (stored) {
				try {
					const parsedSettings = JSON.parse(stored);
					if (!parsedSettings || typeof parsedSettings !== "object") {
						return;
					}
					const normalizedThemeSettings =
						normalizeStoredThemeSettings(parsedSettings);
					const nextSettings = {
						...DEFAULT_SETTINGS,
						...parsedSettings,
						...normalizedThemeSettings,
					};
					setSettings(nextSettings);
					localStorage.setItem(
						"fork-ai-settings",
						JSON.stringify(nextSettings)
					);
				} catch (e) {
					console.error("Failed to parse settings:", e);
				}
			}
		};

		loadSettings();
		setIsLoaded(true);

		// Listen for changes from other components
		const handleSettingsChange = () => {
			loadSettings();
		};

		window.addEventListener(
			"fork-ai-settings-changed",
			handleSettingsChange
		);
		// Storage event handles updates from other tabs
		window.addEventListener("storage", handleSettingsChange);

		return () => {
			window.removeEventListener(
				"fork-ai-settings-changed",
				handleSettingsChange
			);
			window.removeEventListener("storage", handleSettingsChange);
		};
	}, []);

	const updateSettings = (partial: Partial<Settings>) => {
		const now = Date.now();
		const updatedFields: Record<string, number> = {
			...settings.lastModifiedFields,
		};

		// Track which fields were updated
		Object.keys(partial).forEach((key) => {
			if (key !== "lastModifiedFields") {
				updatedFields[key] = now;
			}
		});

		const newSettings = {
			...settings,
			...partial,
			lastModifiedFields: updatedFields,
		};
		setSettings(newSettings);
		localStorage.setItem("fork-ai-settings", JSON.stringify(newSettings));
		// Dispatch event to notify other components (like ThemeApplier)
		window.dispatchEvent(new Event("fork-ai-settings-changed"));
	};

	const resetToDefaults = () => {
		setSettings(DEFAULT_SETTINGS);
		localStorage.setItem(
			"fork-ai-settings",
			JSON.stringify(DEFAULT_SETTINGS)
		);
		window.dispatchEvent(new Event("fork-ai-settings-changed"));
	};

	return {
		settings,
		updateSettings,
		resetToDefaults,
		isLoaded,
	};
}
