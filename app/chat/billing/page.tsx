import { BillingActions } from '@/components/chat/billing-actions'
import { PricingCards } from '@/components/pricing-cards'
import { auth } from '@/lib/auth'
import { resolveWorkspaceContext } from '@/lib/organizations/context'
import { organizationRoleHasPermission } from '@/lib/organizations/roles'
import { getTokenBudgetStatus } from '@/lib/token-budget'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function usageLabel(percent: number): string {
	if (percent >= 100) {
		return 'Limit reached'
	}
	if (percent >= 90) {
		return 'Almost full'
	}
	if (percent >= 70) {
		return 'High'
	}
	if (percent >= 40) {
		return 'Medium'
	}
	return 'Low'
}

export default async function BillingPage() {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user?.id) {
		redirect('/login')
	}

	const workspaceResult = await resolveWorkspaceContext({
		session,
		requiredPermission: 'workspace:read',
	})
	if (!workspaceResult.ok) {
		redirect('/chat')
	}

	const { workspace } = workspaceResult
	const billingScope = workspace.organizationId
		? {
				customerType: 'organization' as const,
				referenceId: workspace.organizationId,
			}
		: { customerType: 'user' as const }
	const canManageBilling =
		workspace.isPersonal ||
		(workspace.role
			? organizationRoleHasPermission(workspace.role, 'billing:write')
			: false)
	const workspaceLabel = workspace.isPersonal
		? 'Personal workspace'
		: 'Organization workspace'
	const status = await getTokenBudgetStatus(
		session.user.id,
		workspace.organizationId
	)
	const trialDaysLeft = status.trialEndsAt
		? Math.max(
				0,
				Math.ceil(
					(status.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
				)
			)
		: 0

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
						Billing & Plan
					</h1>
					<p className="mt-1 text-sm text-white/60">
						Subscription status and usage overview for {workspaceLabel}.
					</p>
				</div>
				<Link
					href="/chat"
					className="rounded-md border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
				>
					Back to chat
				</Link>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 shadow-xl relative overflow-hidden">
				<div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
					<div className="absolute top-[-50%] -left-[10%] w-[20rem] h-[20rem] rounded-full bg-blue-500/10 blur-[80px]" />
					<div className="absolute -bottom-[50%] -right-[10%] w-[20rem] h-[20rem] rounded-full bg-purple-500/10 blur-[80px]" />
				</div>
				<div className="relative z-10">
					<div className="mb-6 flex items-start justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-wider text-white/50 font-semibold">
								Current plan
							</p>
							<p className="mt-1 text-2xl font-bold capitalize text-white">
								{status.tier}
							</p>
						</div>
						{status.tier === 'trial' ? (
							<span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]">
								Trial: {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left
							</span>
						) : null}
					</div>

					<div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
						<div className="mb-3 flex items-center justify-between text-sm">
							<span className="text-white/60">Usage this month</span>
							<span className="font-semibold text-white/90">
								{usageLabel(status.usagePercent)}
							</span>
						</div>
						<div className="h-2 rounded-full bg-white/10 overflow-hidden">
							<div
								className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
								style={{ width: `${Math.min(100, status.usagePercent)}%` }}
							/>
						</div>
						<p className="mt-3 text-xs text-white/40">
							This meter hides raw token counts while tracking your current plan
							usage.
						</p>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 shadow-xl relative overflow-hidden">
				<div className="relative z-10">
					<div className="mb-6">
						<h2 className="text-lg font-semibold text-white">
							Available Plans
						</h2>
						<p className="mt-1 text-sm text-white/60">
							Your current tier is highlighted below.
						</p>
					</div>
					<PricingCards
						currentTier={status.tier}
						billingScope={billingScope}
						canManageBilling={canManageBilling}
					/>
				</div>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 shadow-xl relative overflow-hidden">
				<div className="relative z-10">
					<div className="mb-6">
						<h2 className="text-lg font-semibold text-white">
							Subscribe or Manage
						</h2>
						<p className="mt-1 text-sm text-white/60">
							Start Pro or manage your current subscription in Stripe.
						</p>
					</div>
					<BillingActions
						tier={status.tier}
						billingScope={billingScope}
						canManageBilling={canManageBilling}
					/>
				</div>
			</div>
		</div>
	)
}
