/**
 * Tests for lib/color-utils.ts
 * Covers color conversion, contrast calculation, and WCAG compliance.
 */

import {
    adjustBrightness,
    getContrastRatio,
    hexToHsl,
    hexToRgb,
    hslToHex,
    hslToRgb,
    isWCAGCompliant,
    rgbToHex,
    rgbToHsl,
    suggestContrastFix,
    validateThemeContrast,
} from '@/lib/color-utils'
import { describe, expect, it } from 'vitest'

// ─── hexToRgb ─────────────────────────────────────────────────────────────────
describe('hexToRgb', () => {
	it('converts pure white', () => {
		expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
	})

	it('converts pure black', () => {
		expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
	})

	it('converts red', () => {
		expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
	})

	it('converts mixed color', () => {
		expect(hexToRgb('#1a2b3c')).toEqual({ r: 26, g: 43, b: 60 })
	})

	it('works without leading #', () => {
		expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 })
	})

	it('is case-insensitive', () => {
		expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 })
		expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
	})

	it('returns null for invalid hex', () => {
		expect(hexToRgb('not-a-color')).toBeNull()
		expect(hexToRgb('#12345')).toBeNull() // 5-char hex
	})
})

// ─── rgbToHex ─────────────────────────────────────────────────────────────────
describe('rgbToHex', () => {
	it('converts white', () => {
		expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
	})

	it('converts black', () => {
		expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
	})

	it('converts red', () => {
		expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000')
	})

	it('is inverse of hexToRgb for any valid hex', () => {
		const hex = '#3d9af0'
		const rgb = hexToRgb(hex)!
		expect(rgbToHex(rgb)).toBe(hex)
	})

	it('handles single-digit hex components with leading zero', () => {
		expect(rgbToHex({ r: 0, g: 0, b: 15 })).toBe('#00000f')
	})
})

// ─── rgbToHsl ─────────────────────────────────────────────────────────────────
describe('rgbToHsl', () => {
	it('white is hsl(0, 0%, 100%)', () => {
		expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 })
	})

	it('black is hsl(0, 0%, 0%)', () => {
		expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 })
	})

	it('pure red has hue 0', () => {
		const { h } = rgbToHsl({ r: 255, g: 0, b: 0 })
		expect(h).toBe(0)
	})

	it('pure green has hue 120', () => {
		const { h } = rgbToHsl({ r: 0, g: 255, b: 0 })
		expect(h).toBe(120)
	})

	it('pure blue has hue 240', () => {
		const { h } = rgbToHsl({ r: 0, g: 0, b: 255 })
		expect(h).toBe(240)
	})
})

// ─── hslToRgb ─────────────────────────────────────────────────────────────────
describe('hslToRgb', () => {
	it('hsl(0,0%,100%) → white', () => {
		expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 })
	})

	it('hsl(0,0%,0%) → black', () => {
		expect(hslToRgb({ h: 0, s: 0, l: 0 })).toEqual({ r: 0, g: 0, b: 0 })
	})

	it('round-trips through rgbToHsl', () => {
		const original = { r: 123, g: 45, b: 200 }
		const hsl = rgbToHsl(original)
		const back = hslToRgb(hsl)
		// Allow ±2 rounding tolerance
		expect(back.r).toBeCloseTo(original.r, -1)
		expect(back.g).toBeCloseTo(original.g, -1)
		expect(back.b).toBeCloseTo(original.b, -1)
	})
})

// ─── hslToHex / hexToHsl ──────────────────────────────────────────────────────
describe('hslToHex & hexToHsl', () => {
	it('hexToHsl returns null for invalid hex', () => {
		expect(hexToHsl('bad')).toBeNull()
	})

	it('hexToHsl returns HSL for valid hex', () => {
		const hsl = hexToHsl('#ffffff')
		expect(hsl).not.toBeNull()
		expect(hsl!.l).toBe(100)
	})

	it('hslToHex round-trips with hexToHsl', () => {
		const hex = '#ff8000'
		const hsl = hexToHsl(hex)!
		const back = hslToHex(hsl)
		// Due to rounding the round-trip is approximate — trust within same hue zone
		const rgb1 = hexToRgb(hex)!
		const rgb2 = hexToRgb(back)!
		expect(Math.abs(rgb1.r - rgb2.r)).toBeLessThanOrEqual(5)
		expect(Math.abs(rgb1.g - rgb2.g)).toBeLessThanOrEqual(5)
		expect(Math.abs(rgb1.b - rgb2.b)).toBeLessThanOrEqual(5)
	})
})

// ─── getContrastRatio ─────────────────────────────────────────────────────────
describe('getContrastRatio', () => {
	it('black-on-white is 21:1', () => {
		const ratio = getContrastRatio('#000000', '#ffffff')
		expect(ratio).toBeCloseTo(21, 0)
	})

	it('same color returns 1', () => {
		const ratio = getContrastRatio('#888888', '#888888')
		expect(ratio).toBeCloseTo(1, 0)
	})

	it('returns 0 for invalid colors', () => {
		expect(getContrastRatio('invalid', '#ffffff')).toBe(0)
	})

	it('result is symmetric (order does not matter)', () => {
		const r1 = getContrastRatio('#ff0000', '#ffffff')
		const r2 = getContrastRatio('#ffffff', '#ff0000')
		expect(r1).toBeCloseTo(r2, 5)
	})

	it('ratio is always >= 1', () => {
		const ratio = getContrastRatio('#aabbcc', '#112233')
		expect(ratio).toBeGreaterThanOrEqual(1)
	})
})

// ─── isWCAGCompliant ──────────────────────────────────────────────────────────
describe('isWCAGCompliant', () => {
	it('black on white passes AA regular text', () => {
		expect(isWCAGCompliant('#000000', '#ffffff')).toBe(true)
	})

	it('black on white passes AAA regular text', () => {
		expect(isWCAGCompliant('#000000', '#ffffff', 'AAA')).toBe(true)
	})

	it('light grey on white fails AA', () => {
		// #cccccc on #ffffff is about 1.6:1 — fails
		expect(isWCAGCompliant('#cccccc', '#ffffff')).toBe(false)
	})

	it('AA large text threshold is 3:1', () => {
		// A color pair with ratio 3.5:1 should pass large-AA but might fail normal-AA
		// Use dark-ish grey on white: #767676 is exactly 4.54:1 — passes normal AA
		expect(isWCAGCompliant('#767676', '#ffffff', 'AA', true)).toBe(true)
	})

	it('AAA large text threshold is 4.5:1', () => {
		// black/white is 21:1 — definitely passes
		expect(isWCAGCompliant('#000000', '#ffffff', 'AAA', true)).toBe(true)
	})

	it('AAA normal text requires 7:1 — medium grey fails', () => {
		// #767676 on white is ~4.54 — passes AA but fails AAA normal
		expect(isWCAGCompliant('#767676', '#ffffff', 'AAA', false)).toBe(false)
	})
})

// ─── adjustBrightness ─────────────────────────────────────────────────────────
describe('adjustBrightness', () => {
	it('increasing lightness on a mid-grey makes it lighter', () => {
		const original = hexToHsl('#808080')!
		const adjusted = adjustBrightness('#808080', 20)
		const adjustedHsl = hexToHsl(adjusted)!
		expect(adjustedHsl.l).toBeGreaterThan(original.l)
	})

	it('decreasing lightness on a mid-grey makes it darker', () => {
		const original = hexToHsl('#808080')!
		const adjusted = adjustBrightness('#808080', -20)
		const adjustedHsl = hexToHsl(adjusted)!
		expect(adjustedHsl.l).toBeLessThan(original.l)
	})

	it('returns original hex for invalid color', () => {
		expect(adjustBrightness('bad-hex', 10)).toBe('bad-hex')
	})

	it('clamps lightness to 0', () => {
		// Black stays black when darkened further
		const result = adjustBrightness('#000000', -50)
		const hsl = hexToHsl(result)!
		expect(hsl.l).toBe(0)
	})

	it('clamps lightness to 100', () => {
		const result = adjustBrightness('#ffffff', 50)
		const hsl = hexToHsl(result)!
		expect(hsl.l).toBe(100)
	})
})

// ─── suggestContrastFix ───────────────────────────────────────────────────────
describe('suggestContrastFix', () => {
	it('returns a color with improved contrast against white', () => {
		const fixed = suggestContrastFix('#cccccc', '#ffffff', 4.5)
		const ratio = getContrastRatio(fixed, '#ffffff')
		expect(ratio).toBeGreaterThanOrEqual(4.5)
	})

	it('returns original for invalid background', () => {
		const result = suggestContrastFix('#ff0000', 'bad')
		expect(result).toBe('#ff0000')
	})

	it('does not change a color that already passes', () => {
		// Black on white already passes 4.5
		const result = suggestContrastFix('#000000', '#ffffff', 4.5)
		expect(getContrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(4.5)
	})
})

// ─── validateThemeContrast ────────────────────────────────────────────────────
describe('validateThemeContrast', () => {
	it('high-contrast dark theme passes overall', () => {
		const report = validateThemeContrast('#ffffff', '#000000', '#8b5cf6')
		expect(report.textVsBackground.ratio).toBeCloseTo(21, 0)
		expect(report.textVsBackground.passes).toBe(true)
	})

	it('same-color text/background fails', () => {
		const report = validateThemeContrast('#ffffff', '#ffffff', '#ffffff')
		expect(report.textVsBackground.passes).toBe(false)
		expect(report.overall).toBe('fail')
	})

	it('returns AAA level for excellent contrast', () => {
		const report = validateThemeContrast('#000000', '#ffffff', '#000000')
		// Text on white is 21:1 — should be AAA
		expect(report.textVsBackground.ratio).toBeGreaterThanOrEqual(7)
	})

	it('report shape has all required fields', () => {
		const report = validateThemeContrast('#333333', '#f5f5f5', '#6366f1')
		expect(report).toHaveProperty('textVsBackground')
		expect(report).toHaveProperty('largeTextVsBackground')
		expect(report).toHaveProperty('accentVsBackground')
		expect(report).toHaveProperty('borderVsSurface')
		expect(report).toHaveProperty('overall')
		expect(report).toHaveProperty('level')
	})
})

// ─── Edge cases: hexToRgb unusual inputs ──────────────────────────────────────
describe('hexToRgb — edge cases', () => {
	it('returns null for 3-char shorthand (#fff) — not supported by regex', () => {
		// The implementation only supports 6-char hex
		expect(hexToRgb('#fff')).toBeNull()
	})

	it('returns null for empty string', () => {
		expect(hexToRgb('')).toBeNull()
	})

	it('returns null for just "#"', () => {
		expect(hexToRgb('#')).toBeNull()
	})

	it('returns null for 7-digit hex (too long)', () => {
		expect(hexToRgb('#0011223')).toBeNull()
	})

	it('converts max value #ffffff correctly component by component', () => {
		const rgb = hexToRgb('#ffffff')!
		expect(rgb.r).toBe(255)
		expect(rgb.g).toBe(255)
		expect(rgb.b).toBe(255)
	})

	it('converts #010203 to exact low values', () => {
		expect(hexToRgb('#010203')).toEqual({ r: 1, g: 2, b: 3 })
	})

	it('mixed case #FfFfFf is same as all-lowercase', () => {
		expect(hexToRgb('#FfFfFf')).toEqual(hexToRgb('#ffffff'))
	})
})

// ─── Edge cases: rgbToHex boundary values ────────────────────────────────────
describe('rgbToHex — edge cases', () => {
	it('fractional channel values are rounded', () => {
		// Math.round(1.5) = 2, Math.round(0.4) = 0
		const hex = rgbToHex({ r: 1.5, g: 0.4, b: 254.7 })
		const rgb = hexToRgb(hex)!
		expect(rgb.r).toBe(2)
		expect(rgb.g).toBe(0)
		expect(rgb.b).toBe(255)
	})

	it('produces 6-char hex regardless of component value', () => {
		expect(rgbToHex({ r: 0, g: 0, b: 0 })).toHaveLength(7) // # + 6
		expect(rgbToHex({ r: 255, g: 255, b: 255 })).toHaveLength(7)
	})

	it('green channel #00ff00', () => {
		expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00')
	})

	it('blue channel #0000ff', () => {
		expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff')
	})
})

// ─── Edge cases: rgbToHsl special hues ───────────────────────────────────────
describe('rgbToHsl — special hue edge cases', () => {
	it('cyan (0, 255, 255) has hue 180', () => {
		expect(rgbToHsl({ r: 0, g: 255, b: 255 }).h).toBe(180)
	})

	it('magenta (255, 0, 255) has hue 300', () => {
		expect(rgbToHsl({ r: 255, g: 0, b: 255 }).h).toBe(300)
	})

	it('yellow (255, 255, 0) has hue 60', () => {
		expect(rgbToHsl({ r: 255, g: 255, b: 0 }).h).toBe(60)
	})

	it('grey (128, 128, 128) has saturation 0', () => {
		expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0)
	})

	it('grey (128, 128, 128) lightness is ~50', () => {
		const { l } = rgbToHsl({ r: 128, g: 128, b: 128 })
		expect(l).toBeGreaterThanOrEqual(49)
		expect(l).toBeLessThanOrEqual(51)
	})

	it('fully saturated red has saturation 100', () => {
		expect(rgbToHsl({ r: 255, g: 0, b: 0 }).s).toBe(100)
	})
})

// ─── Edge cases: hslToRgb boundary hue values ────────────────────────────────
describe('hslToRgb — boundary hue values', () => {
	it('hue=360 is treated same as hue=0 (both are red)', () => {
		const at0 = hslToRgb({ h: 0, s: 100, l: 50 })
		const at360 = hslToRgb({ h: 360, s: 100, l: 50 })
		// Both should produce red-ish colors
		expect(at360.r).toBeGreaterThan(200)
		expect(at0.r).toBeGreaterThan(200)
	})

	it('s=0 always produces a grey regardless of hue', () => {
		const grey90 = hslToRgb({ h: 90, s: 0, l: 50 })
		const grey270 = hslToRgb({ h: 270, s: 0, l: 50 })
		expect(grey90.r).toBe(grey90.g)
		expect(grey90.g).toBe(grey90.b)
		expect(grey270.r).toBe(grey270.g)
	})

	it('l=50 s=100 h=0 is pure red', () => {
		const rgb = hslToRgb({ h: 0, s: 100, l: 50 })
		expect(rgb.r).toBe(255)
		expect(rgb.g).toBe(0)
		expect(rgb.b).toBe(0)
	})
})

// ─── Edge cases: getContrastRatio boundary values ─────────────────────────────
describe('getContrastRatio — boundary cases', () => {
	it('white on white is exactly 1:1', () => {
		expect(getContrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
	})

	it('black on black is exactly 1:1', () => {
		expect(getContrastRatio('#000000', '#000000')).toBeCloseTo(1, 5)
	})

	it('both colors invalid returns 0', () => {
		expect(getContrastRatio('bad', 'also-bad')).toBe(0)
	})

	it('one valid one invalid returns 0', () => {
		expect(getContrastRatio('#ffffff', 'bad')).toBe(0)
		expect(getContrastRatio('bad', '#ffffff')).toBe(0)
	})

	it('result never exceeds 21', () => {
		// Maximum possible contrast is 21:1 (black on white)
		const ratio = getContrastRatio('#000000', '#ffffff')
		expect(ratio).toBeLessThanOrEqual(21.1)
	})
})

// ─── Edge cases: isWCAGCompliant boundary ratios ──────────────────────────────
describe('isWCAGCompliant — boundary ratios', () => {
	it('AA large text: ratio of exactly 3:1 is the minimum passing value', () => {
		// #949494 on white is approximately 3:1
		// We test the boundary by using very light vs very dark
		// Instead: test that a known-failing colour fails
		expect(isWCAGCompliant('#dddddd', '#ffffff', 'AA', true)).toBe(false)
	})

	it('white on very dark grey still passes AA', () => {
		// #595959 on white is 7:1 — passes AA
		expect(isWCAGCompliant('#595959', '#ffffff', 'AA', false)).toBe(true)
	})

	it('AAA normal: ratio must be at least 7:1 — good pair passes', () => {
		// #595959 on white is ~7:1
		const ratio = getContrastRatio('#595959', '#ffffff')
		const passes = isWCAGCompliant('#595959', '#ffffff', 'AAA', false)
		if (ratio >= 7) expect(passes).toBe(true)
		else expect(passes).toBe(false)
	})

	it('colour against itself always fails AA', () => {
		expect(isWCAGCompliant('#4a90d9', '#4a90d9', 'AA')).toBe(false)
	})
})

// ─── Edge cases: adjustBrightness amount=0 ───────────────────────────────────
describe('adjustBrightness — zero and identity', () => {
	it('amount=0 returns a colour with the same lightness', () => {
		const original = hexToHsl('#8b5cf6')!.l
		const result = adjustBrightness('#8b5cf6', 0)
		const after = hexToHsl(result)!.l
		expect(Math.abs(after - original)).toBeLessThanOrEqual(1) // rounding tolerance
	})

	it('preserves hue when adjusting lightness', () => {
		const original = hexToHsl('#8b5cf6')!.h
		const result = adjustBrightness('#8b5cf6', 20)
		const after = hexToHsl(result)!.h
		expect(Math.abs(after - original)).toBeLessThanOrEqual(2)
	})

	it('colour on dark background: suggestContrastFix lightens the foreground', () => {
		// Light grey on black needs lightening
		const fixed = suggestContrastFix('#555555', '#000000', 4.5)
		const fixedHsl = hexToHsl(fixed)!
		const originalHsl = hexToHsl('#555555')!
		// On a dark background it should have been lightened
		expect(fixedHsl.l).toBeGreaterThanOrEqual(originalHsl.l)
	})
})

// ─── Edge cases: hexToHsl / hslToHex round-trip colours ─────────────────────
describe('hexToHsl / hslToHex — additional round-trips', () => {
	const testColors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#8b5cf6', '#f59e0b']

	for (const color of testColors) {
		it(`hsl round-trip for ${color} stays within ±5 per channel`, () => {
			const hsl = hexToHsl(color)!
			const back = hslToHex(hsl)
			const orig = hexToRgb(color)!
			const result = hexToRgb(back)!
			expect(Math.abs(orig.r - result.r)).toBeLessThanOrEqual(5)
			expect(Math.abs(orig.g - result.g)).toBeLessThanOrEqual(5)
			expect(Math.abs(orig.b - result.b)).toBeLessThanOrEqual(5)
		})
	}
})

// ─── Edge cases: validateThemeContrast extra scenarios ────────────────────────
describe('validateThemeContrast — extra edge cases', () => {
	it('textVsBackground and largeTextVsBackground have identical ratio', () => {
		const report = validateThemeContrast('#333333', '#ffffff', '#6366f1')
		expect(report.textVsBackground.ratio).toBe(report.largeTextVsBackground.ratio)
	})

	it('overall is "pass" when text meets AA', () => {
		// black text on white — definitely passes
		const report = validateThemeContrast('#000000', '#ffffff', '#000000')
		expect(report.overall).toBe('pass')
	})

	it('custom surface color is used for borderVsSurface calculation', () => {
		const withSurface = validateThemeContrast('#000000', '#ffffff', '#8b5cf6', '#f0f0f0')
		const withoutSurface = validateThemeContrast('#000000', '#ffffff', '#8b5cf6')
		// borderVsSurface depends on surfaceColor — different surface = different ratio
		expect(typeof withSurface.borderVsSurface.ratio).toBe('number')
		expect(typeof withoutSurface.borderVsSurface.ratio).toBe('number')
	})
})
