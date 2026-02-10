/**
 * Theme color constants
 * Centralized location for color values used throughout the app
 *
 * Usage:
 * import { THEME_COLORS } from '@/lib/theme-colors'
 * style={{ color: THEME_COLORS.primary }}
 * className={`border-[${THEME_COLORS.border.default}]`}
 */

export const THEME_COLORS = {
	// Primary brand color (cyan/aqua)
	primary: "#57FCFF",
	primaryRgb: "87, 252, 255",

	// Background colors
	background: {
		dark: "#0d1117", // Code blocks, cards
		darker: "#0A2727", // Gradient start
		darkest: "#0C1110", // Gradient end
		card: "#1a1d24", // Secondary cards
		muted: "#1a2029", // Muted backgrounds
	},

	// Border colors
	border: {
		default: "#252525",
		light: "rgba(255, 255, 255, 0.1)",
		primary: "rgba(87, 252, 255, 0.2)",
	},

	// Text colors (using Tailwind color names for consistency)
	text: {
		foreground: "hsl(var(--foreground))",
		muted: "hsl(var(--muted-foreground))",
	},

	// State colors
	state: {
		error: "hsl(var(--destructive))",
		warning: "#FFA500",
		success: "#22C55E",
		info: "#3B82F6",
	},
} as const;

/**
 * CSS custom properties for use in global styles
 * Add these to your globals.css if needed:
 *
 * :root {
 *   --color-primary: 87, 252, 255;
 *   --color-primary-hex: #57FCFF;
 * }
 */
export const CSS_VARIABLES = {
	"--color-primary-rgb": THEME_COLORS.primaryRgb,
	"--color-primary": THEME_COLORS.primary,
	"--color-bg-dark": THEME_COLORS.background.dark,
	"--color-bg-card": THEME_COLORS.background.card,
	"--color-border": THEME_COLORS.border.default,
} as const;

/**
 * Helper to get opacity variants
 * Usage: getOpacityColor(THEME_COLORS.primary, 0.5) => 'rgba(87, 252, 255, 0.5)'
 */
export function getOpacityColor(hexColor: string, opacity: number): string {
	// Convert hex to RGB
	const r = parseInt(hexColor.slice(1, 3), 16);
	const g = parseInt(hexColor.slice(3, 5), 16);
	const b = parseInt(hexColor.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Common opacity variants for primary color
 */
export const PRIMARY_OPACITY = {
	5: getOpacityColor(THEME_COLORS.primary, 0.05),
	10: getOpacityColor(THEME_COLORS.primary, 0.1),
	20: getOpacityColor(THEME_COLORS.primary, 0.2),
	30: getOpacityColor(THEME_COLORS.primary, 0.3),
	50: getOpacityColor(THEME_COLORS.primary, 0.5),
} as const;
