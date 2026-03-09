/**
 * Color Utilities for Theme Customization
 * Provides color conversion, contrast checking, and WCAG compliance validation
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert HSL to hex
 */
export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): HSL | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

/**
 * Calculate relative luminance for WCAG contrast
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG contrast ratio between two colors
 * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 0;

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG standards
 */
export function isWCAGCompliant(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  largeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  
  if (level === 'AAA') {
    return largeText ? ratio >= 4.5 : ratio >= 7;
  }
  
  // AA level
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Adjust brightness of a color by a percentage
 * @param hex - Color in hex format
 * @param amount - Percentage to adjust (-100 to 100)
 */
export function adjustBrightness(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;

  hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
  return hslToHex(hsl);
}

/**
 * Suggest a color adjustment to meet WCAG standards
 */
export function suggestContrastFix(
  foreground: string,
  background: string,
  targetRatio: number = 4.5
): string {
  let adjusted = foreground;
  const bgRgb = hexToRgb(background);
  if (!bgRgb) return foreground;

  const bgLuminance = getLuminance(bgRgb);
  const isDarkBackground = bgLuminance < 0.5;

  // Try adjusting lightness in steps
  for (let step = 5; step <= 50; step += 5) {
    const adjustment = isDarkBackground ? step : -step;
    adjusted = adjustBrightness(foreground, adjustment);
    
    if (getContrastRatio(adjusted, background) >= targetRatio) {
      return adjusted;
    }
  }

  return adjusted;
}

/**
 * Validate theme contrast for all critical pairs
 */
export interface ThemeContrastReport {
  textVsBackground: { ratio: number; passes: boolean };
  largeTextVsBackground: { ratio: number; passes: boolean };
  accentVsBackground: { ratio: number; passes: boolean };
  borderVsSurface: { ratio: number; passes: boolean };
  overall: 'pass' | 'fail';
  level: 'AAA' | 'AA' | 'fail';
}

export function validateThemeContrast(
  textColor: string,
  backgroundColor: string,
  accentColor: string,
  surfaceColor: string = backgroundColor
): ThemeContrastReport {
  const textVsBackground = getContrastRatio(textColor, backgroundColor);
  const largeTextVsBackground = textVsBackground;
  const accentVsBackground = getContrastRatio(accentColor, backgroundColor);
  const borderVsSurface = getContrastRatio(accentColor, surfaceColor);

  const textPassesAA = textVsBackground >= 4.5;
  const largeTextPassesAA = largeTextVsBackground >= 3;
  const accentPassesAA = accentVsBackground >= 3;
  const borderPassesAA = borderVsSurface >= 3;

  const textPassesAAA = textVsBackground >= 7;
  const largeTextPassesAAA = largeTextVsBackground >= 4.5;

  const allPassAA = textPassesAA && largeTextPassesAA && accentPassesAA && borderPassesAA;
  const allPassAAA = textPassesAAA && largeTextPassesAAA && accentPassesAA && borderPassesAA;

  return {
    textVsBackground: { ratio: textVsBackground, passes: textPassesAA },
    largeTextVsBackground: { ratio: largeTextVsBackground, passes: largeTextPassesAA },
    accentVsBackground: { ratio: accentVsBackground, passes: accentPassesAA },
    borderVsSurface: { ratio: borderVsSurface, passes: borderPassesAA },
    overall: allPassAA ? 'pass' : 'fail',
    level: allPassAAA ? 'AAA' : allPassAA ? 'AA' : 'fail',
  };
}

/**
 * Generate gradient CSS from color stops
 */
export interface ColorStop {
  color: string;
  position: { x: number; y: number }; // 0-1 normalized
}

export function generateGradient(
  stops: ColorStop[],
  width: number,
  height: number
): string {
  if (stops.length === 0) return 'transparent';
  if (stops.length === 1) return stops[0].color;

  // Calculate gradient angle from positions
  const first = stops[0].position;
  const last = stops[stops.length - 1].position;
  
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

  const colorList = stops.map((stop) => stop.color).join(', ');
  return `linear-gradient(${angle}deg, ${colorList})`;
}

/**
 * Apply wave distortion effect (returns SVG filter ID)
 */
export function createWaveFilter(intensity: number): string {
  const scale = intensity / 100;
  return `
    <svg style="position: absolute; width: 0; height: 0">
      <defs>
        <filter id="wave-filter">
          <feTurbulence type="fractalNoise" baseFrequency="${0.01 * scale}" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${20 * scale}" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  `;
}

/**
 * Apply noise effect (returns CSS filter string)
 */
export function getNoiseFilter(amount: number): string {
  const opacity = (amount / 100) * 0.15; // Max 15% opacity
  return `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='${opacity}'/%3E%3C/svg%3E")`;
}

/**
 * Lighten a hex color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;

  // Increase lightness
  const newL = Math.min(100, hsl.l + percent);
  return hslToHex({ ...hsl, l: newL });
}

/**
 * Darken a hex color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;

  // Decrease lightness
  const newL = Math.max(0, hsl.l - percent);
  return hslToHex({ ...hsl, l: newL });
}

/**
 * Add alpha transparency to a hex color
 */
export function addAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
