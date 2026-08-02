import {
	darkenColor,
	generateGradient,
	hexToHsl,
	hslToHex,
	lightenColor,
} from "@/lib/color-utils";
import {
	BACKGROUND_PRESETS,
	getOptimalTextColor,
	getPresetById,
	getPresetChatBackground,
	type ThemePreset,
} from "@/lib/theme-presets";

export type ThemeMode = "dark" | "light" | "system";
export type EffectiveTheme = Exclude<ThemeMode, "system">;

export interface ThemeColorPosition {
	x: number;
	y: number;
}

export interface ThemeSettingsFields {
	theme?: ThemeMode;
	themeBackground?: string;
	themeChatBackground?: string;
	themeCard?: string;
	themeSidebar?: string;
	themePrimary?: string;
	themeSecondary?: string;
	themeTertiary?: string;
	themeBorder?: string;
	themeText?: string;
	themeTextMuted?: string;
	themeColors?: string[];
	themeColorPositions?: ThemeColorPosition[];
	waveIntensity?: number;
	noiseAmount?: number;
	activePreset?: string | null;
}

export type ThemeTokenMap = Record<string, string>;

export interface ResolvedThemePalette {
	themeBackground: string;
	themeChatBackground: string;
	themeCard: string;
	themeSidebar: string;
	themePrimary: string;
	themeSecondary: string;
	themeTertiary: string;
	themeBorder: string;
	themeText: string;
	themeTextMuted: string;
}

export const DEFAULT_THEME_COLOR_POSITIONS: ThemeColorPosition[] = [
	{ x: 0.5, y: 0.2 },
	{ x: 0.5, y: 0.8 },
	{ x: 0.76, y: 0.65 },
];

export const DEFAULT_THEME_SETTINGS = {
	themeBackground: "#0a0d11",
	themeChatBackground: "linear-gradient(180deg, #0A2727 0%, #0C1110 100%)",
	themeCard: "#11151a",
	themeSidebar: "#0a0d11",
	themePrimary: "#57FCFF",
	themeSecondary: "#9B59B6",
	themeTertiary: "#2ECC71",
	themeBorder: "#242b36",
	themeText: "#f0f4f8",
	themeTextMuted: "#94a3b8",
	themeColors: ["#57FCFF", "#9B59B6", "#2ECC71"],
	themeColorPositions: DEFAULT_THEME_COLOR_POSITIONS,
	waveIntensity: 0,
	noiseAmount: 0,
	activePreset: "default" as string | null,
};

export const THEME_CSS_VARIABLES = [
	"--background",
	"--chat-background",
	"--card",
	"--popover",
	"--sidebar",
	"--muted",
	"--accent",
	"--sidebar-accent",
	"--border",
	"--input",
	"--sidebar-border",
	"--foreground",
	"--card-foreground",
	"--popover-foreground",
	"--muted-foreground",
	"--accent-foreground",
	"--sidebar-foreground",
	"--sidebar-accent-foreground",
	"--primary",
	"--primary-foreground",
	"--secondary",
	"--secondary-foreground",
	"--ring",
	"--sidebar-primary",
	"--sidebar-primary-foreground",
	"--sidebar-ring",
	"--theme-secondary",
	"--theme-tertiary",
	"--wave-intensity",
	"--noise-amount",
] as const;

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isHexColor(value: unknown): value is string {
	return isNonEmptyString(value) && /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

function normalizeHexColor(value: string): string {
	const normalized = value.trim();
	return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

function clampPosition(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.max(0.05, Math.min(0.95, value))
		: fallback;
}

export function normalizeThemeColorPositions(
	positions: unknown,
	count: number
): ThemeColorPosition[] {
	const storedPositions = Array.isArray(positions) ? positions : [];

	return Array.from(
		{ length: Math.max(1, Math.min(3, count)) },
		(_, index) => {
			const fallback = DEFAULT_THEME_COLOR_POSITIONS[index];
			const stored = storedPositions[index] as
				| Partial<ThemeColorPosition>
				| undefined;

			return {
				x: clampPosition(stored?.x, fallback.x),
				y: clampPosition(stored?.y, fallback.y),
			};
		}
	);
}

function normalizeThemeColors(
	colors: unknown,
	fallbackColors: string[]
): string[] {
	const storedColors = Array.isArray(colors)
		? colors.filter(isHexColor).map(normalizeHexColor).slice(0, 3)
		: [];

	if (storedColors.length > 0) {
		return storedColors;
	}

	const normalizedFallbacks = fallbackColors
		.filter(isHexColor)
		.map(normalizeHexColor)
		.slice(0, 3);

	return normalizedFallbacks.length > 0
		? normalizedFallbacks
		: [...DEFAULT_THEME_SETTINGS.themeColors];
}

function getHexColorOrDefault(value: unknown, fallback: string): string {
	return isHexColor(value) ? normalizeHexColor(value) : fallback;
}

function deriveLightSurfaceColor(
	sourceHex: string,
	saturationCap: number,
	lightness: number
): string {
	const sourceHsl = hexToHsl(sourceHex);

	if (!sourceHsl) {
		return sourceHex;
	}

	return hslToHex({
		h: sourceHsl.h,
		s: Math.min(sourceHsl.s, saturationCap),
		l: lightness,
	});
}

export function resolveEffectiveTheme(
	theme: ThemeMode,
	resolvedTheme?: string
): EffectiveTheme | null {
	if (theme === "system") {
		return resolvedTheme === "light" || resolvedTheme === "dark"
			? resolvedTheme
			: null;
	}

	return theme;
}

export function getThemeSettingsFromPreset(
	preset: ThemePreset
): Partial<ThemeSettingsFields> {
	return {
		themeBackground: preset.background,
		themeChatBackground: getPresetChatBackground(preset),
		themeCard: preset.card,
		themeSidebar: preset.sidebar,
		themePrimary: preset.primary,
		themeSecondary: preset.secondary,
		themeTertiary: preset.tertiary,
		themeBorder: preset.border,
		themeText: preset.text,
		themeTextMuted: preset.textMuted,
		themeColors: [preset.primary, preset.secondary, preset.tertiary],
		themeColorPositions: DEFAULT_THEME_COLOR_POSITIONS,
		activePreset: preset.id,
	};
}

export function buildCustomThemeFromColors(
	colors: string[],
	positions?: ThemeColorPosition[]
): Partial<ThemeSettingsFields> {
	const normalizedColors = normalizeThemeColors(colors, [
		DEFAULT_THEME_SETTINGS.themePrimary,
	]);
	const normalizedPositions = normalizeThemeColorPositions(
		positions,
		normalizedColors.length
	);
	const primary = normalizedColors[0];
	const secondary = normalizedColors[1] || primary;
	const tertiary = normalizedColors[2] || primary;
	const primaryHsl = hexToHsl(primary);
	const background = primaryHsl
		? hslToHex({
				h: primaryHsl.h,
				s: Math.min(primaryHsl.s, 30),
				l: 7,
			})
		: DEFAULT_THEME_SETTINGS.themeBackground;
	const card = lightenColor(background, 5);
	const sidebar = darkenColor(background, 2);
	const border = lightenColor(background, 12);
	const textColor = getOptimalTextColor(background);
	const textMutedColor = textColor === "#FFFFFF" ? "#a0a0a0" : "#606060";
	const colorStops = normalizedColors.map((color, index) => ({
		color,
		position: normalizedPositions[index],
	}));

	return {
		themePrimary: primary,
		themeSecondary: secondary,
		themeTertiary: tertiary,
		themeBackground: background,
		themeChatBackground: generateGradient(colorStops, 300, 300),
		themeCard: card,
		themeSidebar: sidebar,
		themeBorder: border,
		themeText: textColor,
		themeTextMuted: textMutedColor,
		themeColors: normalizedColors,
		themeColorPositions: normalizedPositions,
		activePreset: null,
	};
}

export function normalizeStoredThemeSettings(
	raw: Partial<ThemeSettingsFields> | null | undefined
): Partial<ThemeSettingsFields> {
	let themeSettings = { ...(raw || {}) };
	const activePreset = isNonEmptyString(themeSettings.activePreset)
		? themeSettings.activePreset
		: null;

	if (activePreset) {
		const fullPreset = getPresetById(activePreset);

		if (fullPreset) {
			if (!isNonEmptyString(themeSettings.themeChatBackground)) {
				themeSettings.themeChatBackground =
					getPresetChatBackground(fullPreset);
			}
			if (!Array.isArray(themeSettings.themeColors)) {
				themeSettings.themeColors = [
					fullPreset.primary,
					fullPreset.secondary,
					fullPreset.tertiary,
				];
			}
		}

		const legacyPreset = BACKGROUND_PRESETS.find(
			(preset) => preset.id === activePreset
		);

		if (legacyPreset) {
			themeSettings = {
				...themeSettings,
				themeBackground: legacyPreset.value,
				themeChatBackground: legacyPreset.style || legacyPreset.value,
				themeCard: legacyPreset.cardValue,
				themeSidebar: legacyPreset.sidebarValue,
				activePreset: null,
			};
		}
	}

	if (
		!isNonEmptyString(themeSettings.themeChatBackground) &&
		isNonEmptyString(themeSettings.themeBackground)
	) {
		themeSettings = {
			...themeSettings,
			themeChatBackground: themeSettings.themeBackground,
		};
	}

	const themeColors = normalizeThemeColors(themeSettings.themeColors, [
		themeSettings.themePrimary || DEFAULT_THEME_SETTINGS.themePrimary,
		themeSettings.themeSecondary || DEFAULT_THEME_SETTINGS.themeSecondary,
		themeSettings.themeTertiary || DEFAULT_THEME_SETTINGS.themeTertiary,
	]);

	return {
		...themeSettings,
		themeColors,
		themeColorPositions: normalizeThemeColorPositions(
			themeSettings.themeColorPositions,
			themeColors.length
		),
	};
}

export function resolveThemePalette(
	settings: ThemeSettingsFields,
	effectiveTheme: EffectiveTheme
): ResolvedThemePalette {
	const darkPalette: ResolvedThemePalette = {
		themeBackground:
			settings.themeBackground || DEFAULT_THEME_SETTINGS.themeBackground,
		themeChatBackground:
			settings.themeChatBackground ||
			settings.themeBackground ||
			DEFAULT_THEME_SETTINGS.themeChatBackground,
		themeCard: settings.themeCard || DEFAULT_THEME_SETTINGS.themeCard,
		themeSidebar:
			settings.themeSidebar || DEFAULT_THEME_SETTINGS.themeSidebar,
		themePrimary:
			settings.themePrimary || DEFAULT_THEME_SETTINGS.themePrimary,
		themeSecondary:
			settings.themeSecondary || DEFAULT_THEME_SETTINGS.themeSecondary,
		themeTertiary:
			settings.themeTertiary || DEFAULT_THEME_SETTINGS.themeTertiary,
		themeBorder: settings.themeBorder || DEFAULT_THEME_SETTINGS.themeBorder,
		themeText: settings.themeText || DEFAULT_THEME_SETTINGS.themeText,
		themeTextMuted:
			settings.themeTextMuted || DEFAULT_THEME_SETTINGS.themeTextMuted,
	};

	if (effectiveTheme === "dark") {
		return darkPalette;
	}

	const backgroundSource = getHexColorOrDefault(
		settings.themeBackground,
		DEFAULT_THEME_SETTINGS.themeBackground
	);
	const cardSource = getHexColorOrDefault(
		settings.themeCard,
		DEFAULT_THEME_SETTINGS.themeCard
	);
	const sidebarSource = getHexColorOrDefault(
		settings.themeSidebar,
		DEFAULT_THEME_SETTINGS.themeSidebar
	);
	const borderSource = getHexColorOrDefault(
		settings.themeBorder,
		DEFAULT_THEME_SETTINGS.themeBorder
	);
	const primary = getHexColorOrDefault(
		settings.themePrimary,
		DEFAULT_THEME_SETTINGS.themePrimary
	);
	const secondary = getHexColorOrDefault(
		settings.themeSecondary,
		DEFAULT_THEME_SETTINGS.themeSecondary
	);
	const tertiary = getHexColorOrDefault(
		settings.themeTertiary,
		DEFAULT_THEME_SETTINGS.themeTertiary
	);
	const background = deriveLightSurfaceColor(backgroundSource, 24, 97);
	const card = deriveLightSurfaceColor(cardSource, 18, 99);
	const sidebar = deriveLightSurfaceColor(sidebarSource, 22, 94);
	const border = deriveLightSurfaceColor(borderSource, 16, 84);

	return {
		themeBackground: background,
		themeChatBackground: `linear-gradient(180deg, ${background} 0%, ${card} 100%)`,
		themeCard: card,
		themeSidebar: sidebar,
		themePrimary: primary,
		themeSecondary: secondary,
		themeTertiary: tertiary,
		themeBorder: border,
		themeText: "#0f172a",
		themeTextMuted: "#475569",
	};
}

export function resolveThemeTokens(
	settings: ThemeSettingsFields,
	effectiveTheme: EffectiveTheme
): ThemeTokenMap {
	const palette = resolveThemePalette(settings, effectiveTheme);
	const primaryForeground = getOptimalTextColor(palette.themePrimary);
	const secondaryForeground = getOptimalTextColor(palette.themeSecondary);
	const waveIntensity =
		(settings.waveIntensity ?? DEFAULT_THEME_SETTINGS.waveIntensity) / 100;
	const noiseAmount =
		(settings.noiseAmount ?? DEFAULT_THEME_SETTINGS.noiseAmount) / 100;

	return {
		"--background": palette.themeBackground,
		"--chat-background": palette.themeChatBackground,
		"--card": palette.themeCard,
		"--popover": palette.themeCard,
		"--sidebar": palette.themeSidebar,
		"--muted": palette.themeCard,
		"--accent": palette.themeCard,
		"--sidebar-accent": palette.themeCard,
		"--border": palette.themeBorder,
		"--input": palette.themeBorder,
		"--sidebar-border": palette.themeBorder,
		"--foreground": palette.themeText,
		"--card-foreground": palette.themeText,
		"--popover-foreground": palette.themeText,
		"--muted-foreground": palette.themeTextMuted,
		"--accent-foreground": palette.themeTextMuted,
		"--sidebar-foreground": palette.themeText,
		"--sidebar-accent-foreground": palette.themeTextMuted,
		"--primary": palette.themePrimary,
		"--primary-foreground": primaryForeground,
		"--secondary": palette.themeSecondary,
		"--secondary-foreground": secondaryForeground,
		"--ring": palette.themePrimary,
		"--sidebar-primary": palette.themePrimary,
		"--sidebar-primary-foreground": primaryForeground,
		"--sidebar-ring": palette.themePrimary,
		"--theme-secondary": palette.themeSecondary,
		"--theme-tertiary": palette.themeTertiary,
		"--wave-intensity": `${waveIntensity}`,
		"--noise-amount": `${noiseAmount}`,
	};
}
