'use client'

import type React from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { buildPreservedNextQuery, resolveAuthCallbackPath } from '@/lib/auth-redirect'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export const dynamic = 'force-dynamic'

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128
const EMAIL_CHECK_DELAY_MS = 350

const NAME_REQUIRED_MESSAGE = 'Enter your full name.'
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address.'
const EMAIL_TAKEN_MESSAGE =
	'This email is already registered. Use another email or sign in.'
const EMAIL_CHECK_ERROR_MESSAGE = "Couldn't verify email right now."
const PASSWORD_TOO_SHORT_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
const PASSWORD_TOO_LONG_MESSAGE = `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`
const PASSWORD_MISMATCH_MESSAGE = 'Passwords do not match.'
const GENERIC_SIGNUP_ERROR_MESSAGE =
	"We couldn't create your account. Please try again."
const GOOGLE_SIGNUP_ERROR_MESSAGE = 'Failed to sign up with Google'

type SignupFormData = {
	name: string
	email: string
	password: string
	confirmPassword: string
}

type SignupTouchedFields = Record<keyof SignupFormData, boolean>
type SignupValidationErrors = Record<keyof SignupFormData, string>

type EmailAvailabilityState = {
	status: 'idle' | 'checking' | 'available' | 'taken' | 'error'
	email: string
	message?: string
}

type EmailAvailabilityResult = {
	status: 'available' | 'taken' | 'error'
	message?: string
}

const INITIAL_FORM_DATA: SignupFormData = {
	name: '',
	email: '',
	password: '',
	confirmPassword: '',
}

const INITIAL_TOUCHED_FIELDS: SignupTouchedFields = {
	name: false,
	email: false,
	password: false,
	confirmPassword: false,
}

function normalizeName(name: string) {
	return name.trim()
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getPasswordError(password: string) {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return PASSWORD_TOO_SHORT_MESSAGE
	}

	if (password.length > MAX_PASSWORD_LENGTH) {
		return PASSWORD_TOO_LONG_MESSAGE
	}

	return ''
}

function getValidationErrors(formData: SignupFormData): SignupValidationErrors {
	return {
		name: normalizeName(formData.name) ? '' : NAME_REQUIRED_MESSAGE,
		email: isValidEmail(normalizeEmail(formData.email)) ? '' : INVALID_EMAIL_MESSAGE,
		password: getPasswordError(formData.password),
		confirmPassword:
			formData.password === formData.confirmPassword
				? ''
				: PASSWORD_MISMATCH_MESSAGE,
	}
}

function mapSignupErrorMessage(message?: string) {
	switch (message) {
		case 'Invalid email':
			return INVALID_EMAIL_MESSAGE
		case 'Password too short':
			return PASSWORD_TOO_SHORT_MESSAGE
		case 'Password too long':
			return PASSWORD_TOO_LONG_MESSAGE
		case 'User already exists. Use another email.':
		case 'User already exists.':
			return EMAIL_TAKEN_MESSAGE
		default:
			return message?.trim() || GENERIC_SIGNUP_ERROR_MESSAGE
	}
}

async function fetchEmailAvailability(
	email: string,
	signal: AbortSignal
): Promise<EmailAvailabilityResult> {
	try {
		const response = await fetch('/api/signup/availability', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email }),
			signal,
		})
		const payload = (await response.json().catch(() => null)) as
			| { available?: boolean; error?: string }
			| null

		if (response.ok && payload?.available) {
			return { status: 'available' }
		}

		if (response.status === 409) {
			return {
				status: 'taken',
				message: payload?.error || EMAIL_TAKEN_MESSAGE,
			}
		}

		return {
			status: 'error',
			message: payload?.error || EMAIL_CHECK_ERROR_MESSAGE,
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}

		return {
			status: 'error',
			message: EMAIL_CHECK_ERROR_MESSAGE,
		}
	}
}

export default function SignupPage() {
	const searchParams = useSearchParams()
	const [formData, setFormData] = useState(INITIAL_FORM_DATA)
	const [touchedFields, setTouchedFields] =
		useState<SignupTouchedFields>(INITIAL_TOUCHED_FIELDS)
	const [hasSubmitted, setHasSubmitted] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [formError, setFormError] = useState('')
	const [successEmail, setSuccessEmail] = useState('')
	const [emailAvailability, setEmailAvailability] = useState<EmailAvailabilityState>(
		{
			status: 'idle',
			email: '',
		}
	)

	const callbackURL = resolveAuthCallbackPath(searchParams.get('next'))
	const preservedNextQuery = buildPreservedNextQuery(searchParams.get('next'))
	const emailCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const emailCheckAbortRef = useRef<AbortController | null>(null)
	const emailCheckRequestIdRef = useRef(0)

	const normalizedName = normalizeName(formData.name)
	const normalizedEmail = normalizeEmail(formData.email)
	const validationErrors = getValidationErrors(formData)

	const nameError =
		touchedFields.name || hasSubmitted ? validationErrors.name : ''
	const emailError =
		touchedFields.email || hasSubmitted ? validationErrors.email : ''
	const passwordError =
		touchedFields.password || hasSubmitted ? validationErrors.password : ''
	const confirmPasswordError =
		touchedFields.confirmPassword || hasSubmitted
			? validationErrors.confirmPassword
			: ''

	const emailHasTakenState =
		emailAvailability.email === normalizedEmail &&
		emailAvailability.status === 'taken'
	const emailShouldShowStatus = !emailError && normalizedEmail.length > 0

	let emailStatusMessage = ''
	let emailStatusClassName = 'text-muted-foreground'

	if (emailShouldShowStatus && emailAvailability.email === normalizedEmail) {
		if (emailAvailability.status === 'checking') {
			emailStatusMessage = 'Checking email availability...'
		} else if (emailAvailability.status === 'available') {
			emailStatusMessage = 'Email is available.'
			emailStatusClassName = 'text-emerald-400'
		} else if (emailAvailability.status === 'taken') {
			emailStatusMessage = emailAvailability.message || EMAIL_TAKEN_MESSAGE
			emailStatusClassName = 'text-red-400'
		} else if (emailAvailability.status === 'error') {
			emailStatusMessage = emailAvailability.message || EMAIL_CHECK_ERROR_MESSAGE
			emailStatusClassName = 'text-amber-300'
		}
	}

	async function runEmailAvailabilityCheck(email: string) {
		const requestId = emailCheckRequestIdRef.current + 1
		emailCheckRequestIdRef.current = requestId

		emailCheckAbortRef.current?.abort()

		const controller = new AbortController()
		emailCheckAbortRef.current = controller
		setEmailAvailability({
			status: 'checking',
			email,
		})

		try {
			const result = await fetchEmailAvailability(email, controller.signal)

			if (requestId !== emailCheckRequestIdRef.current) {
				return null
			}

			setEmailAvailability({
				status: result.status,
				email,
				message: result.message,
			})

			return result
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return null
			}

			const result = {
				status: 'error' as const,
				message: EMAIL_CHECK_ERROR_MESSAGE,
			}

			if (requestId === emailCheckRequestIdRef.current) {
				setEmailAvailability({
					status: 'error',
					email,
					message: EMAIL_CHECK_ERROR_MESSAGE,
				})
			}

			return result
		}
	}

	async function ensureEmailAvailability(email: string) {
		if (
			emailAvailability.email === email &&
			emailAvailability.status === 'available'
		) {
			return true
		}

		if (emailAvailability.email === email && emailAvailability.status === 'taken') {
			return false
		}

		if (emailCheckTimeoutRef.current) {
			clearTimeout(emailCheckTimeoutRef.current)
			emailCheckTimeoutRef.current = null
		}

		const result = await runEmailAvailabilityCheck(email)

		if (!result) {
			return true
		}

		return result.status !== 'taken'
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const fieldName = e.target.name as keyof SignupFormData
		const { value } = e.target

		setFormData((prev) => ({
			...prev,
			[fieldName]: value,
		}))
		setTouchedFields((prev) => ({
			...prev,
			[fieldName]: true,
		}))
		setFormError('')

		if (fieldName === 'email') {
			const nextEmail = normalizeEmail(value)

			if (emailCheckTimeoutRef.current) {
				clearTimeout(emailCheckTimeoutRef.current)
				emailCheckTimeoutRef.current = null
			}

			emailCheckAbortRef.current?.abort()

			setEmailAvailability((current) => {
				if (!nextEmail) {
					return {
						status: 'idle',
						email: '',
					}
				}

				if (!isValidEmail(nextEmail)) {
					return {
						status: 'idle',
						email: nextEmail,
					}
				}

				if (current.email === nextEmail) {
					return current
				}

				return {
					status: 'idle',
					email: nextEmail,
				}
			})
		}
	}

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		const fieldName = e.target.name as keyof SignupFormData

		setTouchedFields((prev) => ({
			...prev,
			[fieldName]: true,
		}))
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setHasSubmitted(true)
		setTouchedFields({
			name: true,
			email: true,
			password: true,
			confirmPassword: true,
		})
		setFormError('')

		const nextValidationErrors = getValidationErrors(formData)
		if (Object.values(nextValidationErrors).some(Boolean)) {
			return
		}

		const emailIsAvailable = await ensureEmailAvailability(normalizedEmail)
		if (!emailIsAvailable) {
			return
		}

		setIsLoading(true)

		try {
			const result = await authClient.signUp.email({
				name: normalizedName,
				email: normalizedEmail,
				password: formData.password,
				callbackURL,
			})

			if (result.error) {
				const mappedMessage = mapSignupErrorMessage(result.error.message)
				setFormError(mappedMessage)

				if (mappedMessage === EMAIL_TAKEN_MESSAGE) {
					setEmailAvailability({
						status: 'taken',
						email: normalizedEmail,
						message: mappedMessage,
					})
				}

				return
			}

			if (!result.data) {
				setFormError(GENERIC_SIGNUP_ERROR_MESSAGE)
				return
			}

			setSuccessEmail(normalizedEmail)
			setFormData(INITIAL_FORM_DATA)
			setTouchedFields(INITIAL_TOUCHED_FIELDS)
			setHasSubmitted(false)
			setEmailAvailability({
				status: 'idle',
				email: '',
			})
		} catch (error) {
			console.error('Unexpected sign up failure:', error)
			setFormError(GENERIC_SIGNUP_ERROR_MESSAGE)
		} finally {
			setIsLoading(false)
		}
	}

	const handleGoogleSignUp = async () => {
		setFormError('')

		try {
			const result = await authClient.signIn.social({
				provider: 'google',
				callbackURL,
			})

			if (result?.error) {
				setFormError(GOOGLE_SIGNUP_ERROR_MESSAGE)
			}
		} catch (error) {
			console.error('Google sign up failed:', error)
			setFormError(GOOGLE_SIGNUP_ERROR_MESSAGE)
		}
	}

	useEffect(() => {
		if (successEmail) {
			return
		}

		if (emailCheckTimeoutRef.current) {
			clearTimeout(emailCheckTimeoutRef.current)
			emailCheckTimeoutRef.current = null
		}

		if (!normalizedEmail) {
			emailCheckAbortRef.current?.abort()
			setEmailAvailability({
				status: 'idle',
				email: '',
			})
			return
		}

		if (!isValidEmail(normalizedEmail)) {
			emailCheckAbortRef.current?.abort()
			setEmailAvailability({
				status: 'idle',
				email: normalizedEmail,
			})
			return
		}

		emailCheckTimeoutRef.current = setTimeout(() => {
			void runEmailAvailabilityCheck(normalizedEmail)
		}, EMAIL_CHECK_DELAY_MS)

		return () => {
			if (emailCheckTimeoutRef.current) {
				clearTimeout(emailCheckTimeoutRef.current)
				emailCheckTimeoutRef.current = null
			}
		}
	}, [normalizedEmail, successEmail])

	useEffect(() => {
		return () => {
			if (emailCheckTimeoutRef.current) {
				clearTimeout(emailCheckTimeoutRef.current)
			}

			emailCheckAbortRef.current?.abort()
		}
	}, [])

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1,
				delayChildren: 0.2,
			},
		},
	}

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				type: 'spring' as const,
				stiffness: 100,
				damping: 10,
			},
		},
	}

	return (
		<AuroraBackground className="min-h-screen w-full">
			<div className="min-h-screen w-full relative flex flex-col pt-20">
				<div className="flex-1 flex items-center justify-center p-4">
					<motion.div
						variants={containerVariants}
						initial="hidden"
						animate="visible"
						className="w-full max-w-md z-10"
					>
						<motion.div variants={itemVariants} className="text-center mb-8">
							<h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
								{successEmail ? 'Check your email' : 'Create account'}
							</h1>
							<p className="text-muted-foreground text-lg">
								{successEmail
									? 'Verify your email to finish setting up your account'
									: 'Join us to start building'}
							</p>
						</motion.div>

						<motion.div
							variants={itemVariants}
							className="glass rounded-2xl p-8 shadow-2xl border-white/10 backdrop-blur-xl"
						>
							{successEmail ? (
								<motion.div variants={itemVariants} className="space-y-6">
									<Alert className="border-emerald-400/30 bg-emerald-400/10 text-emerald-50">
										<AlertTitle className="text-emerald-100">
											Account created
										</AlertTitle>
										<AlertDescription className="text-emerald-100/90">
											{`Account created. Check ${successEmail} for a verification email before signing in.`}
										</AlertDescription>
									</Alert>

									<div className="text-sm text-muted-foreground leading-6">
										Once you verify your email, you can sign in and continue
										with ForkAI.
									</div>

									<Link
										href={`/login${preservedNextQuery}`}
										className="flex w-full items-center justify-center rounded-xl bg-white py-3 font-medium text-black transition-all shadow-lg shadow-white/10 hover:bg-white/90 hover:shadow-white/20"
									>
										Sign in
									</Link>
								</motion.div>
							) : (
								<>
									<form onSubmit={handleSubmit} className="space-y-6">
										<motion.div variants={itemVariants} className="space-y-2">
											<Label htmlFor="name" className="text-white">
												Full Name
											</Label>
											<Input
												id="name"
												name="name"
												type="text"
												autoComplete="name"
												placeholder="Enter your full name"
												value={formData.name}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={Boolean(nameError)}
												className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-white/20 focus:ring-white/10 transition-all duration-300 hover:bg-white/10"
												required
											/>
											{nameError && (
												<p className="text-sm text-red-400">{nameError}</p>
											)}
										</motion.div>

										<motion.div variants={itemVariants} className="space-y-2">
											<Label htmlFor="email" className="text-white">
												Email
											</Label>
											<Input
												id="email"
												name="email"
												type="email"
												autoComplete="email"
												placeholder="Enter your email"
												value={formData.email}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={Boolean(emailError || emailHasTakenState)}
												className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-white/20 focus:ring-white/10 transition-all duration-300 hover:bg-white/10"
												required
											/>
											{emailError ? (
												<p className="text-sm text-red-400">{emailError}</p>
											) : (
												emailStatusMessage && (
													<p
														role="status"
														aria-live="polite"
														className={`text-sm ${emailStatusClassName}`}
													>
														{emailStatusMessage}
													</p>
												)
											)}
										</motion.div>

										<motion.div variants={itemVariants} className="space-y-2">
											<Label htmlFor="password" className="text-white">
												Password
											</Label>
											<Input
												id="password"
												name="password"
												type="password"
												autoComplete="new-password"
												placeholder="Create a password"
												value={formData.password}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={Boolean(passwordError)}
												className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-white/20 focus:ring-white/10 transition-all duration-300 hover:bg-white/10"
												required
											/>
											{passwordError ? (
												<p className="text-sm text-red-400">{passwordError}</p>
											) : (
												<p className="text-sm text-muted-foreground">
													Use {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH}{' '}
													characters.
												</p>
											)}
										</motion.div>

										<motion.div variants={itemVariants} className="space-y-2">
											<Label htmlFor="confirmPassword" className="text-white">
												Confirm Password
											</Label>
											<Input
												id="confirmPassword"
												name="confirmPassword"
												type="password"
												autoComplete="new-password"
												placeholder="Confirm your password"
												value={formData.confirmPassword}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={Boolean(confirmPasswordError)}
												className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-white/20 focus:ring-white/10 transition-all duration-300 hover:bg-white/10"
												required
											/>
											{confirmPasswordError && (
												<p className="text-sm text-red-400">
													{confirmPasswordError}
												</p>
											)}
										</motion.div>

										<motion.div
											variants={itemVariants}
											className="flex items-start space-x-2"
										>
											<input
												type="checkbox"
												id="terms"
												className="mt-1 rounded border-white/20 bg-white/5 text-white focus:ring-white/20 transition-colors group-hover:border-white/40"
												required
											/>
											<label
												htmlFor="terms"
												className="text-sm text-muted-foreground"
											>
												I agree to the{' '}
												<Link
													href="#"
													className="text-white hover:underline transition-colors"
												>
													Terms of Service
												</Link>{' '}
												and{' '}
												<Link
													href="#"
													className="text-white hover:underline transition-colors"
												>
													Privacy Policy
												</Link>
											</label>
										</motion.div>

										{formError && formError !== emailStatusMessage && (
											<motion.div variants={itemVariants}>
												<Alert
													variant="destructive"
													className="border-red-500/40 bg-red-500/10 text-red-100"
												>
													<AlertTitle className="text-red-100">
														Sign up failed
													</AlertTitle>
													<AlertDescription className="text-red-100/90">
														{formError}
													</AlertDescription>
												</Alert>
											</motion.div>
										)}

										<motion.div
											variants={itemVariants}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
										>
											<Button
												type="submit"
												disabled={isLoading}
												className="w-full bg-white text-black hover:bg-white/90 font-medium py-3 rounded-xl transition-all shadow-lg shadow-white/10 hover:shadow-white/20"
											>
												{isLoading
													? 'Creating account...'
													: 'Create account'}
											</Button>
										</motion.div>
									</form>

									<motion.div variants={itemVariants} className="mt-6 text-center">
										<p className="text-muted-foreground">
											Already have an account?{' '}
											<Link
												href={`/login${preservedNextQuery}`}
												className="text-white hover:underline font-medium transition-colors"
											>
												Sign in
											</Link>
										</p>
									</motion.div>
								</>
							)}
						</motion.div>

						{!successEmail && (
							<motion.div variants={itemVariants} className="mt-6">
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<div className="w-full border-t border-white/10" />
									</div>
									<div className="relative flex justify-center text-sm">
										<span className="px-2 bg-transparent text-muted-foreground backdrop-blur-sm">
											Or continue with
										</span>
									</div>
								</div>

								<div className="mt-6 grid grid-cols-2 gap-3">
									<motion.button
										type="button"
										onClick={handleGoogleSignUp}
										whileHover={{
											scale: 1.02,
											backgroundColor: 'rgba(255, 255, 255, 1)',
											color: '#000',
										}}
										whileTap={{ scale: 0.98 }}
										className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-200 group"
									>
										<svg
											className="w-5 h-5 mr-2 text-white group-hover:text-black transition-colors duration-200"
											viewBox="0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
											/>
											<path
												fill="currentColor"
												d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
											/>
											<path
												fill="currentColor"
												d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
											/>
											<path
												fill="currentColor"
												d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
											/>
										</svg>
										Google
									</motion.button>
									<motion.button
										type="button"
										whileHover={{
											scale: 1.02,
											backgroundColor: 'rgba(255, 255, 255, 1)',
											color: '#000',
										}}
										whileTap={{ scale: 0.98 }}
										className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-200 group"
									>
										<svg
											className="w-5 h-5 mr-2 text-white group-hover:text-black transition-colors duration-200"
											fill="currentColor"
											viewBox="0 0 24 24"
										>
											<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
										</svg>
										GitHub
									</motion.button>
								</div>
							</motion.div>
						)}
					</motion.div>
				</div>
			</div>
		</AuroraBackground>
	)
}
