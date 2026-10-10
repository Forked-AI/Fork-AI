import DesktopAuthPage from '@/app/desktop/auth/page'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({
	auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/components/desktop-authorization', () => ({
	DesktopAuthorization: ({ email }: { email: string }) => (
		<p>Continue as {email}</p>
	),
}))

const validQuery = {
	client_id: 'forkai-desktop',
	state: 'statefordesktop1',
	code_challenge: 'a'.repeat(43),
	code_challenge_method: 'S256',
}

describe('Desktop browser authorization page', () => {
	beforeEach(() => {
		mocks.getSession.mockReset()
		mocks.getSession.mockResolvedValue({
			user: { email: 'desktop@example.com' },
		})
	})

	it.each(['a'.repeat(43), `${'a'.repeat(43)}=`])(
		'accepts the auth integration’s padded and unpadded PKCE challenge %s',
		async (challenge) => {
			render(
				await DesktopAuthPage({
					searchParams: Promise.resolve({
						...validQuery,
						code_challenge: challenge,
					}),
				})
			)
			expect(
				screen.getByText('Continue as desktop@example.com')
			).toBeInTheDocument()
		}
	)

	it('rejects malformed challenges without reading the user session', async () => {
		render(
			await DesktopAuthPage({
				searchParams: Promise.resolve({
					...validQuery,
					code_challenge: 'invalid',
				}),
			})
		)
		expect(
			screen.getByRole('heading', { name: 'Open ForkAI Desktop to sign in' })
		).toBeInTheDocument()
		expect(mocks.getSession).not.toHaveBeenCalled()
	})

	it('preserves the PKCE request through browser login', async () => {
		mocks.getSession.mockResolvedValue(null)
		render(await DesktopAuthPage({ searchParams: Promise.resolve(validQuery) }))
		const login = new URL(
			screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')!,
			'http://localhost'
		)
		const callback = new URL(
			login.searchParams.get('next')!,
			'http://localhost'
		)
		expect(callback.pathname).toBe('/desktop/auth')
		expect(Object.fromEntries(callback.searchParams)).toEqual(validQuery)
	})
})
