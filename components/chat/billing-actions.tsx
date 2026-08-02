'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { authClient } from '@/lib/auth-client'
import { Loader2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
	type SubscriptionBillingScope,
	useSubscriptionCheckout,
} from '@/hooks/use-subscription-checkout'

type BillingTier = 'free' | 'trial' | 'pro'
type PendingAction = 'monthly' | 'annual' | 'portal' | null

interface BillingActionsProps {
	tier: BillingTier
	billingScope?: SubscriptionBillingScope
	canManageBilling?: boolean
}

interface BetterAuthError {
	message?: string
}

interface BetterAuthResult<TData = unknown> {
	data?: TData
	error?: BetterAuthError | null
}

interface RedirectPayload {
	url?: string
	redirect?: boolean
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message
	}

	return fallback
}

function getRedirectUrl(data: unknown): string | null {
	if (!data) {
		return null
	}

	if (typeof data === 'string') {
		return data
	}

	if (
		typeof data === 'object' &&
		'url' in data &&
		typeof data.url === 'string'
	) {
		return data.url
	}

	return null
}

function getSubscriptionClient() {
	return (
		authClient as unknown as {
			subscription?: {
				upgrade?: (
					_payload: Record<string, unknown>
				) => Promise<BetterAuthResult<RedirectPayload>>
				upgradeSubscription?: (
					_payload: Record<string, unknown>
				) => Promise<BetterAuthResult<RedirectPayload>>
				billingPortal?: (
					_payload: Record<string, unknown>
				) => Promise<BetterAuthResult<RedirectPayload>>
				createBillingPortal?: (
					_payload: Record<string, unknown>
				) => Promise<BetterAuthResult<RedirectPayload>>
			}
		}
	).subscription
}

function getCheckoutToastContent(status: string | null): {
	title: string
	description: string
	variant?: 'destructive'
} | null {
	if (status === 'success') {
		return {
			title: 'Checkout completed',
			description:
				'Subscription is being activated. Your billing status will refresh shortly.',
		}
	}

	if (status === 'canceled') {
		return {
			title: 'Checkout canceled',
			description: 'No changes were made to your subscription.',
			variant: 'destructive',
		}
	}

	return null
}

function scopePayload(scope?: SubscriptionBillingScope) {
	if (!scope || scope.customerType === 'user') {
		return {}
	}

	return {
		customerType: 'organization',
		referenceId: scope.referenceId,
	}
}

export function BillingActions({
	tier,
	billingScope,
	canManageBilling = true,
}: BillingActionsProps) {
	const { toast } = useToast()
	const pathname = usePathname()
	const router = useRouter()
	const searchParams = useSearchParams()
	const [pendingAction, setPendingAction] = useState<PendingAction>(null)
	const handledCheckoutStatusRef = useRef<string | null>(null)
	const { startUpgrade, isCheckingOut } = useSubscriptionCheckout(billingScope)

	const handleUpgrade = useCallback(
		async (annual: boolean) => {
			setPendingAction(annual ? 'annual' : 'monthly')
			await startUpgrade(annual)
			setPendingAction(null)
		},
		[startUpgrade]
	)

	useEffect(() => {
		const checkoutStatus = searchParams.get('checkout')

		if (!checkoutStatus) {
			handledCheckoutStatusRef.current = null
			// Normal flow continues
		} else {
			if (handledCheckoutStatusRef.current !== checkoutStatus) {
				handledCheckoutStatusRef.current = checkoutStatus

				const toastContent = getCheckoutToastContent(checkoutStatus)
				if (toastContent) {
					toast(toastContent)
				}

				const nextParams = new URLSearchParams(searchParams.toString())
				nextParams.delete('checkout')
				const nextUrl = nextParams.toString()
					? `${pathname}?${nextParams.toString()}`
					: pathname
				router.replace(nextUrl, { scroll: false })
			}
		}

		// Handle autostart
		const autostart = searchParams.get('autostart')
		if (autostart === 'pro' && !isCheckingOut && pendingAction === null) {
			const isAnnual = searchParams.get('annual') === 'true'
			handleUpgrade(isAnnual)

			// Clean up autostart params so it doesn't loop
			const nextParams = new URLSearchParams(searchParams.toString())
			nextParams.delete('autostart')
			nextParams.delete('annual')
			const nextUrl = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname
			router.replace(nextUrl, { scroll: false })
		}
	}, [
		pathname,
		router,
		searchParams,
		toast,
		pendingAction,
		isCheckingOut,
		handleUpgrade,
	])

	const openBillingPortal = async () => {
		setPendingAction('portal')

		try {
			const subscriptionClient = getSubscriptionClient()
			const billingPortalMethod =
				subscriptionClient?.billingPortal ??
				subscriptionClient?.createBillingPortal

			if (typeof billingPortalMethod !== 'function') {
				throw new Error(
					'Billing portal is unavailable right now. Please try again later.'
				)
			}

			const returnUrl = `${window.location.origin}/chat/billing`
			const result = await billingPortalMethod({
				returnUrl,
				disableRedirect: true,
				...scopePayload(billingScope),
			})

			if (result?.error?.message) {
				throw new Error(result.error.message)
			}

			const redirectUrl = getRedirectUrl(result?.data)
			if (!redirectUrl) {
				throw new Error(
					'Billing portal URL was not returned. Please try again in a moment.'
				)
			}

			window.location.assign(redirectUrl)
		} catch (error) {
			toast({
				title: 'Unable to open billing portal',
				description: getErrorMessage(
					error,
					'We could not open Stripe billing portal. Please try again.'
				),
				variant: 'destructive',
			})
			setPendingAction(null)
		}
	}

	const isBusy = pendingAction !== null
	const canOpenBillingPortal =
		canManageBilling && (tier === 'pro' || tier === 'trial')

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row">
				<Button
					type="button"
					onClick={() => void handleUpgrade(false)}
					disabled={isBusy || tier === 'pro' || !canManageBilling}
				>
					{pendingAction === 'monthly' ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							Redirecting...
						</>
					) : tier === 'pro' ? (
						'Pro monthly active'
					) : (
						'Start Pro monthly'
					)}
				</Button>

				<Button
					type="button"
					variant="outline"
					onClick={() => void handleUpgrade(true)}
					disabled={isBusy || tier === 'pro' || !canManageBilling}
				>
					{pendingAction === 'annual' ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							Redirecting...
						</>
					) : tier === 'pro' ? (
						'Pro annual active'
					) : (
						'Start Pro annual'
					)}
				</Button>

				{canOpenBillingPortal ? (
					<Button
						type="button"
						variant="secondary"
						onClick={() => void openBillingPortal()}
						disabled={isBusy}
					>
						{pendingAction === 'portal' ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Opening...
							</>
						) : (
							'Manage billing'
						)}
					</Button>
				) : null}
			</div>

			<p className="text-xs text-muted-foreground">
				{!canManageBilling
					? 'You can view workspace usage, but billing changes require an owner, admin, or billing admin.'
					: tier === 'pro'
						? 'Your Pro plan is active. Use billing portal to update payment details, switch intervals, or cancel.'
						: 'Choose monthly or annual Pro checkout to unlock the full plan after redirect.'}
			</p>
		</div>
	)
}
