/**
 * Theme Presets
 * WCAG AA-compliant preset color palettes and artistic themes
 */

import { getContrastRatio } from "./color-utils";

/**
 * Calculate optimal text color (white or black) based on background
 */
export function getOptimalTextColor(backgroundColor: string): string {
	const contrastWithWhite = getContrastRatio("#FFFFFF", backgroundColor);
	const contrastWithBlack = getContrastRatio("#0F172A", backgroundColor);
	return contrastWithWhite >= contrastWithBlack ? "#FFFFFF" : "#0F172A";
}

export interface ThemePreset {
	id: string;
	name: string;
	// Complete theme package
	background: string; // Main background color
	chatBackground?: string; // Visible chat surface (supports gradients)
	card: string; // Card/surface background
	sidebar: string; // Sidebar background
	primary: string; // Primary accent (buttons, links)
	secondary: string; // Secondary accent
	tertiary: string; // Tertiary accent
	border: string; // Border color
	// Text colors (auto-calculated based on contrast)
	text: string; // Primary text color
	textMuted: string; // Muted/secondary text color
	description: string;
	wcagCompliant: boolean;
	category: "compliant" | "artistic";
}

export interface BackgroundPreset {
	id: string;
	name: string;
	value: string; // --background (solid color for utilities)
	style?: string; // Optional CSS background property (e.g. gradients)
	cardValue: string; // --card
	sidebarValue: string; // --sidebar
	description?: string;
}

/**
 * Legacy background-only presets kept for migrating older stored settings.
 */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
	{
		id: "midnight",
		name: "Midnight",
		value: "#000000",
		cardValue: "#121212",
		sidebarValue: "#000000",
		description: "OLED friendly pure black",
	},
	{
		id: "slate",
		name: "Slate",
		value: "#0f172a",
		cardValue: "#1e293b",
		sidebarValue: "#0f172a",
		description: "Clean slate gray",
	},
];

/**
 * WCAG AA-Compliant Preset Themes
 * Guaranteed to meet accessibility standards:
 * - Text vs background: 4.5:1
 * - Large text: 3:1
 * - UI components: 3:1
 */
export const COMPLIANT_PRESETS: ThemePreset[] = [
	{
		id: "default",
		name: "Default",
		background: "#0a0d11",
		chatBackground: "linear-gradient(180deg, #0A2727 0%, #0C1110 100%)",
		card: "#11151a",
		sidebar: "#0a0d11",
		primary: "#57FCFF",
		secondary: "#9B59B6",
		tertiary: "#2ECC71",
		border: "#242b36",
		text: "#f0f4f8",
		textMuted: "#94a3b8",
		description: "Cyan on dark — the original Fork.AI look",
		wcagCompliant: true,
		category: "compliant",
	},
	{
		id: "emerald",
		name: "Emerald",
		background: "#0A1216",
		card: "#0C1110",
		sidebar: "#0A0D11",
		primary: "#57FCFF",
		secondary: "#9B59B6",
		tertiary: "#2ECC71",
		border: "#1a3333",
		text: "#f0f4f8",
		textMuted: "#94a3b8",
		description: "Cyan, purple, and green on a dark green gradient",
		wcagCompliant: true,
		category: "compliant",
	},
	{
		id: "ocean",
		name: "Ocean",
		background: "#0a1628",
		card: "#132337",
		sidebar: "#0a1628",
		primary: "#1E90FF",
		secondary: "#00CED1",
		tertiary: "#4169E1",
		border: "#1e3a5f",
		text: "#e0f2fe",
		textMuted: "#7dd3fc",
		description: "Deep blues and cyan - calm and focused",
		wcagCompliant: true,
		category: "compliant",
	},
	{
		id: "forest",
		name: "Forest",
		background: "#0a1f0f",
		card: "#112d16",
		sidebar: "#0a1f0f",
		primary: "#228B22",
		secondary: "#32CD32",
		tertiary: "#90EE90",
		border: "#1e4620",
		text: "#dcfce7",
		textMuted: "#86efac",
		description: "Rich greens - natural and balanced",
		wcagCompliant: true,
		category: "compliant",
	},
	{
		id: "sunset",
		name: "Sunset",
		background: "#1a0f0a",
		card: "#2a1710",
		sidebar: "#1a0f0a",
		primary: "#FF6B35",
		secondary: "#FF9A56",
		tertiary: "#FFC947",
		border: "#3d2517",
		text: "#fef3c7",
		textMuted: "#fcd34d",
		description: "Warm oranges and yellows - energetic and creative",
		wcagCompliant: true,
		category: "compliant",
	},
	{
		id: "lavender",
		name: "Lavender",
		background: "#1a0f1f",
		card: "#2d1835",
		sidebar: "#1a0f1f",
		primary: "#9B72CB",
		secondary: "#B794D7",
		tertiary: "#D4B5E8",
		border: "#3d2550",
		text: "#f3e8ff",
		textMuted: "#d8b4fe",
		description: "Soft purples - elegant and soothing",
		wcagCompliant: true,
		category: "compliant",
	},
	{
		id: "ember",
		name: "Ember",
		background: "#1f0a0a",
		card: "#2f1111",
		sidebar: "#1f0a0a",
		primary: "#E74C3C",
		secondary: "#FF6B6B",
		tertiary: "#FFA07A",
		border: "#4a1f1f",
		text: "#fee2e2",
		textMuted: "#fca5a5",
		description: "Bold reds - passionate and powerful",
		wcagCompliant: true,
		category: "compliant",
	},
];

/**
 * Artistic Preset Themes
 * May not meet WCAG AA standards but offer striking visuals
 * Users are warned when selecting these themes
 */
export const ARTISTIC_PRESETS: ThemePreset[] = [
	{
		id: "aurora",
		name: "Aurora",
		background: "#0a0d11",
		card: "#11151a",
		sidebar: "#0a0d11",
		primary: "#00F5A0",
		secondary: "#00D9F5",
		tertiary: "#B084FF",
		border: "#1f2937",
		text: "#f0f4f8",
		textMuted: "#94a3b8",
		description:
			"Electric greens, cyan, and purple - inspired by northern lights",
		wcagCompliant: false,
		category: "artistic",
	},
	{
		id: "nebula",
		name: "Nebula",
		background: "#0a0d11",
		card: "#11151a",
		sidebar: "#0a0d11",
		primary: "#FF0080",
		secondary: "#7928CA",
		tertiary: "#FF4D4D",
		border: "#1f2937",
		text: "#f0f4f8",
		textMuted: "#94a3b8",
		description: "Vivid pinks and purples - cosmic and bold",
		wcagCompliant: false,
		category: "artistic",
	},
	{
		id: "lava",
		name: "Lava",
		background: "#0a0d11",
		card: "#11151a",
		sidebar: "#0a0d11",
		primary: "#FF3C00",
		secondary: "#FF9500",
		tertiary: "#FFB800",
		border: "#1f2937",
		text: "#f0f4f8",
		textMuted: "#94a3b8",
		description: "Molten oranges and yellows - intense and fiery",
		wcagCompliant: false,
		category: "artistic",
	},
	{
		id: "neon",
		name: "Neon",
		background: "#000000",
		card: "#0a0a0a",
		sidebar: "#000000",
		primary: "#39FF14",
		secondary: "#FF10F0",
		tertiary: "#00E5FF",
		border: "#1a1a1a",
		text: "#ffffff",
		textMuted: "#a0a0a0",
		description: "Bright neon colors - electric and modern",
		wcagCompliant: false,
		category: "artistic",
	},
];

/**
 * All presets combined
 */
export const ALL_PRESETS = [...COMPLIANT_PRESETS, ...ARTISTIC_PRESETS];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): ThemePreset | undefined {
	return ALL_PRESETS.find((preset) => preset.id === id);
}

export function getPresetChatBackground(preset: ThemePreset): string {
	return preset.chatBackground || preset.background;
}

/**
 * Validate a preset's WCAG compliance
 * (used during development to verify presets)
 */
export function verifyPresetCompliance(preset: ThemePreset): boolean {
	// Test text against background
	const textBgContrast = getContrastRatio(preset.text, preset.background);
	// Test primary against background
	const primaryBgContrast = getContrastRatio(preset.primary, preset.background);
	
	// WCAG AA requires 4.5:1 for normal text, 3:1 for large text/UI
	return textBgContrast >= 4.5 && primaryBgContrast >= 3;
}

/**
 * Get default preset (used on first load)
 */
export function getDefaultPreset(): ThemePreset {
	return COMPLIANT_PRESETS[0]; // Default theme
}

/**
 * Quick swatch colors for manual selection
 * These are individual colors users can pick for any dot
 */
export const QUICK_SWATCHES = [
	"#FFFFFF", // White
	"#F8B4D9", // Pink
	"#B4A7F8", // Lavender
	"#FF6B9D", // Hot pink
	"#FF6B35", // Coral
	"#FFD93D", // Yellow
	"#2ECC71", // Green
	"#57FCFF", // Cyan (brand)
	"#4169E1", // Royal blue
	"#9B59B6", // Purple
	"#E67E22", // Orange
	"#95A5A6", // Gray
];
