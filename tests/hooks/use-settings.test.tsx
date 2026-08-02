import { useSettings } from '@/hooks/use-settings'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('useSettings', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('migrates legacy theme fields to persisted color stops', async () => {
		localStorage.setItem(
			'fork-ai-settings',
			JSON.stringify({
				themePrimary: '#123456',
				themeSecondary: '#abcdef',
				themeTertiary: '#fedcba',
			})
		)

		const { result } = renderHook(() => useSettings())

		await waitFor(() => expect(result.current.isLoaded).toBe(true))
		expect(result.current.settings.themeColors).toEqual([
			'#123456',
			'#abcdef',
			'#fedcba',
		])
		expect(result.current.settings.themeColorPositions).toHaveLength(3)

		const persisted = JSON.parse(
			localStorage.getItem('fork-ai-settings') || '{}'
		)
		expect(persisted.themeColors).toEqual(['#123456', '#abcdef', '#fedcba'])
	})

	it('synchronizes theme updates across hook consumers in the same tab', async () => {
		const first = renderHook(() => useSettings())
		const second = renderHook(() => useSettings())

		await waitFor(() => {
			expect(first.result.current.isLoaded).toBe(true)
			expect(second.result.current.isLoaded).toBe(true)
		})

		act(() => {
			first.result.current.updateSettings({
				themeColors: ['#123456'],
				themeColorPositions: [{ x: 0.2, y: 0.7 }],
			})
		})

		await waitFor(() => {
			expect(second.result.current.settings.themeColors).toEqual(['#123456'])
			expect(second.result.current.settings.themeColorPositions).toEqual([
				{ x: 0.2, y: 0.7 },
			])
		})
	})
})
