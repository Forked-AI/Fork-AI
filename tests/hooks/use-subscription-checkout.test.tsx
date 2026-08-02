import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	toast: vi.fn(),
	upgrade: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: mocks.toast }),
}))

vi.mock('@/lib/auth-client', () => ({
	authClient: {
		subscription: {
			upgrade: mocks.upgrade,
		},
	},
}))

import { useSubscriptionCheckout } from '@/hooks/use-subscription-checkout'

describe('useSubscriptionCheckout', () => {
	beforeEach(() => {
		mocks.toast.mockReset()
		mocks.upgrade.mockReset()
		mocks.upgrade.mockResolvedValue({ data: {} })
	})

	it('passes organization customer scope to Better Auth checkout', async () => {
		const { result } = renderHook(() =>
			useSubscriptionCheckout({
				customerType: 'organization',
				referenceId: 'org-1',
			})
		)

		await act(async () => {
			await result.current.startUpgrade(true)
		})

		expect(mocks.upgrade).toHaveBeenCalledWith(
			expect.objectContaining({
				plan: 'pro',
				annual: true,
				customerType: 'organization',
				referenceId: 'org-1',
				disableRedirect: true,
			})
		)
	})

	it('keeps personal checkout payload free of organization fields', async () => {
		const { result } = renderHook(() => useSubscriptionCheckout())

		await act(async () => {
			await result.current.startUpgrade(false)
		})

		expect(mocks.upgrade).toHaveBeenCalledWith(
			expect.not.objectContaining({
				customerType: 'organization',
				referenceId: expect.any(String),
			})
		)
	})
})
