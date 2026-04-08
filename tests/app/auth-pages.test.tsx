import LoginPage from '@/app/login/page'
import SignupPage from '@/app/signup/page'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const EMAIL_TAKEN_MESSAGE =
	'This email is already registered. Use another email or sign in.'

const mockSearchParams = vi.hoisted(() => ({
	value: new URLSearchParams(),
}))

const authClientMocks = vi.hoisted(() => ({
	signInEmail: vi.fn(),
	signInSocial: vi.fn(),
	signUpEmail: vi.fn(),
}))

vi.mock('next/navigation', () => ({
	useSearchParams: () => mockSearchParams.value,
}))

vi.mock('next/link', () => ({
	default: ({
		href,
		children,
		prefetch: _prefetch,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		href: string
		prefetch?: boolean
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}))

vi.mock('@/lib/auth-client', () => ({
	authClient: {
		signIn: {
			email: authClientMocks.signInEmail,
			social: authClientMocks.signInSocial,
		},
		signUp: {
			email: authClientMocks.signUpEmail,
		},
	},
}))

vi.mock('@/components/ui/aurora-background', () => ({
	AuroraBackground: ({
		children,
		className,
	}: {
		children: React.ReactNode
		className?: string
	}) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock('@/components/ui/input', () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
	Label: ({
		children,
		...props
	}: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/alert', () => ({
	Alert: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
	AlertTitle: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
	AlertDescription: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('framer-motion', () => {
	function createMotionElement(tag: string) {
		return ({
			children,
			variants: _variants,
			initial: _initial,
			animate: _animate,
			transition: _transition,
			whileHover: _whileHover,
			whileTap: _whileTap,
			...props
		}: Record<string, unknown> & { children?: React.ReactNode }) =>
			React.createElement(tag, props, children)
	}

	return {
		motion: new Proxy(
			{},
			{
				get: (_target, property) => createMotionElement(String(property)),
			}
		),
	}
})

function createJsonResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	})
}

async function wait(ms: number) {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Auth entry pages', () => {
	beforeEach(() => {
		mockSearchParams.value = new URLSearchParams()
		authClientMocks.signInEmail.mockReset()
		authClientMocks.signInSocial.mockReset()
		authClientMocks.signUpEmail.mockReset()
		authClientMocks.signInEmail.mockResolvedValue({})
		authClientMocks.signInSocial.mockResolvedValue({})
		authClientMocks.signUpEmail.mockResolvedValue({
			data: {
				user: {
					id: 'user-1',
				},
			},
			error: null,
		})

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(createJsonResponse(200, { available: true }))
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	it('passes next through login email and social sign-in, and preserves it on the signup link', async () => {
		mockSearchParams.value = new URLSearchParams({
			next: '/share/token-1?openInChat=1',
		})
		const user = userEvent.setup()

		render(<LoginPage />)

		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'owner@example.com' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'password123' },
		})
		const loginForm = screen.getByRole('button', { name: 'Sign in' }).closest('form')
		expect(loginForm).not.toBeNull()
		fireEvent.submit(loginForm!)

		await waitFor(() => {
			expect(authClientMocks.signInEmail).toHaveBeenCalledWith({
				email: 'owner@example.com',
				password: 'password123',
				rememberMe: false,
				callbackURL: '/share/token-1?openInChat=1',
			})
		})

		await user.click(screen.getByRole('button', { name: 'Google' }))

		expect(authClientMocks.signInSocial).toHaveBeenCalledWith({
			provider: 'google',
			callbackURL: '/share/token-1?openInChat=1',
		})
		expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
			'href',
			'/signup?next=%2Fshare%2Ftoken-1%3FopenInChat%3D1'
		)
	})

	it('passes next through signup email and social sign-up, normalizes email, and preserves it on the login link', async () => {
		mockSearchParams.value = new URLSearchParams({
			next: '/share/token-2?openInChat=1',
		})
		const user = userEvent.setup()

		render(<SignupPage />)

		await user.click(screen.getByRole('button', { name: 'Google' }))

		expect(authClientMocks.signInSocial).toHaveBeenCalledWith({
			provider: 'google',
			callbackURL: '/share/token-2?openInChat=1',
		})

		fireEvent.change(screen.getByLabelText('Full Name'), {
			target: { value: ' Viewer User ' },
		})
		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: ' Viewer@Example.com ' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'password123' },
		})
		fireEvent.change(screen.getByLabelText('Confirm Password'), {
			target: { value: 'password123' },
		})

		const signupForm = screen
			.getByRole('button', { name: 'Create account' })
			.closest('form')
		expect(signupForm).not.toBeNull()
		fireEvent.submit(signupForm!)

		await waitFor(() => {
			expect(authClientMocks.signUpEmail).toHaveBeenCalledWith({
				name: 'Viewer User',
				email: 'viewer@example.com',
				password: 'password123',
				callbackURL: '/share/token-2?openInChat=1',
			})
		})

		expect(
			screen.getByText(
				'Account created. Check viewer@example.com for a verification email before signing in.'
			)
		).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
			'href',
			'/login?next=%2Fshare%2Ftoken-2%3FopenInChat%3D1'
		)
	})

	it('blocks submit and shows an inline error when passwords do not match', () => {
		render(<SignupPage />)

		fireEvent.change(screen.getByLabelText('Full Name'), {
			target: { value: 'Viewer User' },
		})
		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'viewer@example.com' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'password123' },
		})
		fireEvent.change(screen.getByLabelText('Confirm Password'), {
			target: { value: 'password456' },
		})

		const signupForm = screen
			.getByRole('button', { name: 'Create account' })
			.closest('form')
		expect(signupForm).not.toBeNull()
		fireEvent.submit(signupForm!)

		expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
		expect(authClientMocks.signUpEmail).not.toHaveBeenCalled()
	})

	it('shows live email-format validation before submit', () => {
		render(<SignupPage />)

		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'not-an-email' },
		})

		expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it('debounces availability checks and renders available and taken states', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(createJsonResponse(200, { available: true }))
			.mockResolvedValueOnce(
				createJsonResponse(409, {
					available: false,
					error: EMAIL_TAKEN_MESSAGE,
				})
			)
		vi.stubGlobal('fetch', fetchMock)

		render(<SignupPage />)

		const emailInput = screen.getByLabelText('Email')

		fireEvent.change(emailInput, {
			target: { value: 'viewer@example.com' },
		})

		expect(fetchMock).not.toHaveBeenCalled()
		await wait(200)
		expect(fetchMock).not.toHaveBeenCalled()

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/signup/availability')
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
			email: 'viewer@example.com',
		})
		expect(screen.getByText('Email is available.')).toBeInTheDocument()

		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'taken@example.com' },
		})

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2)
		})
		await waitFor(() => {
			expect(screen.getByText(EMAIL_TAKEN_MESSAGE)).toBeInTheDocument()
		})
	})

	it('prevents signup when availability says the email is taken', async () => {
		vi.useFakeTimers()

		const fetchMock = vi.fn().mockResolvedValue(
			createJsonResponse(409, {
				available: false,
				error: EMAIL_TAKEN_MESSAGE,
			})
		)
		vi.stubGlobal('fetch', fetchMock)

		render(<SignupPage />)

		fireEvent.change(screen.getByLabelText('Full Name'), {
			target: { value: 'Viewer User' },
		})
		await act(async () => {
			fireEvent.change(screen.getByLabelText('Email'), {
				target: { value: 'viewer@example.com' },
			})
			await Promise.resolve()
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'password123' },
		})
		fireEvent.change(screen.getByLabelText('Confirm Password'), {
			target: { value: 'password123' },
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(350)
			await Promise.resolve()
		})

		expect(screen.getByText(EMAIL_TAKEN_MESSAGE)).toBeInTheDocument()

		const signupForm = screen
			.getByRole('button', { name: 'Create account' })
			.closest('form')
		expect(signupForm).not.toBeNull()
		fireEvent.submit(signupForm!)

		expect(authClientMocks.signUpEmail).not.toHaveBeenCalled()
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('renders Better Auth submit errors from { error } responses', async () => {
		authClientMocks.signUpEmail.mockResolvedValue({
			data: null,
			error: {
				message: 'User already exists. Use another email.',
			},
		})

		render(<SignupPage />)

		fireEvent.change(screen.getByLabelText('Full Name'), {
			target: { value: 'Viewer User' },
		})
		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'viewer@example.com' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'password123' },
		})
		fireEvent.change(screen.getByLabelText('Confirm Password'), {
			target: { value: 'password123' },
		})

		const signupForm = screen
			.getByRole('button', { name: 'Create account' })
			.closest('form')
		expect(signupForm).not.toBeNull()
		fireEvent.submit(signupForm!)

		await waitFor(() => {
			expect(screen.getByText(EMAIL_TAKEN_MESSAGE)).toBeInTheDocument()
		})
	})

	it('renders the post-signup success state from { data } responses', async () => {
		render(<SignupPage />)

		fireEvent.change(screen.getByLabelText('Full Name'), {
			target: { value: 'Viewer User' },
		})
		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'viewer@example.com' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'password123' },
		})
		fireEvent.change(screen.getByLabelText('Confirm Password'), {
			target: { value: 'password123' },
		})

		const signupForm = screen
			.getByRole('button', { name: 'Create account' })
			.closest('form')
		expect(signupForm).not.toBeNull()
		fireEvent.submit(signupForm!)

		await waitFor(() => {
			expect(
				screen.getByText(
					'Account created. Check viewer@example.com for a verification email before signing in.'
				)
			).toBeInTheDocument()
		})

		expect(
			screen.queryByRole('button', { name: 'Create account' })
		).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Google' })).not.toBeInTheDocument()
	})
})
