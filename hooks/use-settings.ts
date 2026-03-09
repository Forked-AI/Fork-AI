"use client";

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
	// Theme customization - complete theme package
	themeBackground: string; // Main background
	themeCard: string; // Card background
	themeSidebar: string; // Sidebar background
	themePrimary: string; // Primary accent
	themeSecondary: string; // Secondary accent
	themeTertiary: string; // Tertiary accent
	themeBorder: string; // Border color
	themeText: string; // Auto-calculated text color
	themeTextMuted: string; // Auto-calculated muted text
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
	// Theme customization defaults (Default preset)
	themeBackground: "#0a0d11",
	themeCard: "#11151a",
	themeSidebar: "#0a0d11",
	themePrimary: "#57FCFF",
	themeSecondary: "#9B59B6",
	themeTertiary: "#2ECC71",
	themeBorder: "#242b36",
	themeText: "#f0f4f8",
	themeTextMuted: "#94a3b8",
	waveIntensity: 0,
	noiseAmount: 0,
	activePreset: "default",
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
					setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
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
		// Dispatch event to notify other components (like ThemeSynchronizer)
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
