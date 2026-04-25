import { prisma } from "./prisma";

export type BillingTier = "free" | "trial" | "pro";

export interface SubscriptionEntitlement {
	tier: BillingTier;
	monthlyTokenBudget: number;
	usageWindowStart: Date;
	usageWindowEnd: Date;
	trialEndsAt: Date | null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
	"active",
	"trialing",
	"past_due",
]);

const DEFAULT_TRIAL_DAYS = 7;
const DEFAULT_FREE_MONTHLY_TOKEN_BUDGET = 500000;
const DEFAULT_PRO_MONTHLY_TOKEN_BUDGET = 10000000;

let hasLoggedSubscriptionTableWarning = false;

interface StripeSubscriptionRow {
	plan: string | null;
	status: string | null;
	periodEnd: Date | null;
	trialEnd: Date | null;
	endedAt: Date | null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getTrialDays(): number {
	return parsePositiveInt(process.env.PRO_TRIAL_DAYS, DEFAULT_TRIAL_DAYS);
}

export function getFreeMonthlyTokenBudget(): number {
	return parsePositiveInt(
		process.env.FREE_MONTHLY_TOKEN_BUDGET,
		DEFAULT_FREE_MONTHLY_TOKEN_BUDGET
	);
}

export function getProMonthlyTokenBudget(): number {
	return parsePositiveInt(
		process.env.PRO_MONTHLY_TOKEN_BUDGET,
		DEFAULT_PRO_MONTHLY_TOKEN_BUDGET
	);
}

function getMonthWindow(date: Date): { start: Date; end: Date } {
	const start = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
	);
	const end = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)
	);
	return { start, end };
}

async function hasActiveProSubscription(userId: string): Promise<boolean> {
	try {
		const rows = await prisma.$queryRaw<StripeSubscriptionRow[]>`
			SELECT "plan", "status", "periodEnd", "trialEnd", "endedAt"
			FROM "subscription"
			WHERE "referenceId" = ${userId}
		`;

		if (!rows.length) {
			return false;
		}

		const nowMs = Date.now();
		return rows.some((row) => {
			const plan = (row.plan ?? "").toLowerCase();
			if (plan !== "pro") {
				return false;
			}

			const status = (row.status ?? "").toLowerCase();
			if (ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
				return true;
			}

			const endedAtMs = row.endedAt ? new Date(row.endedAt).getTime() : null;
			if (endedAtMs && endedAtMs <= nowMs) {
				return false;
			}

			const periodEndMs = row.periodEnd
				? new Date(row.periodEnd).getTime()
				: null;
			const trialEndMs = row.trialEnd ? new Date(row.trialEnd).getTime() : null;

			return Boolean(
				(periodEndMs && periodEndMs > nowMs) ||
					(trialEndMs && trialEndMs > nowMs)
			);
		});
	} catch (error) {
		if (!hasLoggedSubscriptionTableWarning) {
			hasLoggedSubscriptionTableWarning = true;
			console.warn(
				"[Subscription] Unable to query Stripe subscription table. Falling back to signup-trial/free tiers.",
				error
			);
		}
		return false;
	}
}

export async function resolveSubscriptionEntitlement(
	userId: string
): Promise<SubscriptionEntitlement> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { createdAt: true },
	});

	const now = new Date();
	const { start, end } = getMonthWindow(now);

	if (!user) {
		return {
			tier: "free",
			monthlyTokenBudget: getFreeMonthlyTokenBudget(),
			usageWindowStart: start,
			usageWindowEnd: end,
			trialEndsAt: null,
		};
	}

	const proSubscriptionActive = await hasActiveProSubscription(userId);
	const trialEndsAt = new Date(user.createdAt);
	trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + getTrialDays());
	const trialActive = trialEndsAt.getTime() > now.getTime();

	const tier: BillingTier = proSubscriptionActive
		? "pro"
		: trialActive
			? "trial"
			: "free";

	return {
		tier,
		monthlyTokenBudget:
			tier === "free"
				? getFreeMonthlyTokenBudget()
				: getProMonthlyTokenBudget(),
		usageWindowStart: start,
		usageWindowEnd: end,
		trialEndsAt: trialActive ? trialEndsAt : null,
	};
}
