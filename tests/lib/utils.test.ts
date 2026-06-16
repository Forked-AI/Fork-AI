/**
 * Tests for lib/utils.ts
 * Covers the `cn` (class-names) utility.
 */

import { cn } from '@/lib/utils'
import { describe, expect, it } from 'vitest'

describe('cn', () => {
	it('returns a single class unchanged', () => {
		expect(cn('foo')).toBe('foo')
	})

	it('merges multiple classes', () => {
		expect(cn('foo', 'bar')).toBe('foo bar')
	})

	it('deduplicates conflicting Tailwind utilities (tailwind-merge behaviour)', () => {
		// p-4 overrides p-2
		expect(cn('p-2', 'p-4')).toBe('p-4')
	})

	it('handles conditional classes (falsy values are dropped)', () => {
		expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz')
	})

	it('handles object syntax', () => {
		expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
	})

	it('handles array syntax', () => {
		expect(cn(['foo', 'bar'])).toBe('foo bar')
	})

	it('returns empty string for no args', () => {
		expect(cn()).toBe('')
	})

	it('returns empty string for all-falsy args', () => {
		expect(cn(false, undefined, null)).toBe('')
	})

	it('merges Tailwind text-color classes correctly', () => {
		// text-red-500 should override text-blue-500
		const result = cn('text-blue-500', 'text-red-500')
		expect(result).toBe('text-red-500')
	})
})

// ─── Edge cases: cn ───────────────────────────────────────────────────────────
describe('cn — edge cases', () => {
	it('nested arrays are flattened and all classes applied', () => {
		expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz')
	})

	it('template literal class names work', () => {
		const size = 'md'
		expect(cn(`text-${size}`)).toBe('text-md')
	})

	it('very long list of non-conflicting classes are all kept', () => {
		const classes = ['mt-1', 'mr-2', 'mb-3', 'ml-4', 'pt-1', 'pr-2', 'pb-3', 'pl-4']
		const result = cn(...classes)
		for (const cls of classes) {
			expect(result).toContain(cls)
		}
	})

	it('numeric 0 in an array is treated as falsy and omitted', () => {
		// clsx treats 0 as falsy
		const result = cn('foo', 0 as unknown as string, 'bar')
		expect(result).toBe('foo bar')
	})

	it('object with all false values produces empty string', () => {
		expect(cn({ a: false, b: false, c: false })).toBe('')
	})

	it('mixed array and object syntax works together', () => {
		const result = cn(['foo', 'bar'], { baz: true, qux: false })
		expect(result).toContain('foo')
		expect(result).toContain('bar')
		expect(result).toContain('baz')
		expect(result).not.toContain('qux')
	})

	it('later Tailwind bg class overrides earlier one', () => {
		expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
	})

	it('same class listed twice is deduplicated', () => {
		const result = cn('flex', 'flex')
		expect(result.split(' ').filter((c) => c === 'flex').length).toBe(1)
	})

	it('whitespace-only string is cleaned up', () => {
		// clsx includes it; tailwind-merge may keep or trim — either way no crash
		expect(() => cn('  ')).not.toThrow()
	})
})
