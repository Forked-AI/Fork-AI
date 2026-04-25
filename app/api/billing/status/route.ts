import { auth } from "@/lib/auth";
import { getTokenBudgetStatus } from "@/lib/token-budget";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function getTrialDaysLeft(trialEndsAt: Date | null): number {
	if (!trialEndsAt) {
		return 0;
	}

	const diffMs = trialEndsAt.getTime() - Date.now();
	if (diffMs <= 0) {
		return 0;
	}

	return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export async function GET() {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const status = await getTokenBudgetStatus(session.user.id);
		return NextResponse.json({
			plan: {
				tier: status.tier,
				isTrial: status.tier === "trial",
				trialEndsAt: status.trialEndsAt?.toISOString() ?? null,
				trialDaysLeft: getTrialDaysLeft(status.trialEndsAt),
			},
			usage: {
				percent: status.usagePercent,
				band: status.usageBand,
			},
		});
	} catch (error) {
		console.error("[GET /api/billing/status] Error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
