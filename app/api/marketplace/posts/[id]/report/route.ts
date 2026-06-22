import { auth } from "@/lib/auth";
import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import {
	marketplaceReportSchema,
	reportMarketplacePost,
} from "@/lib/marketplace/posts";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const rateLimit = await checkRequestRateLimit(request, {
			bucket: "marketplace-post-report",
			maxRequests: 10,
			windowSeconds: 60,
			identityParts: [session.user.id],
			error: "Too many marketplace report requests.",
			scope: "marketplace/posts/report",
		});
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = marketplaceReportSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id } = await params;
		const reported = await reportMarketplacePost({
			userId: session.user.id,
			postId: id,
			reason: parsed.data.reason,
		});
		if (!reported) {
			return NextResponse.json(
				{ error: "Marketplace post not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		logServerError("marketplace/posts", "report_failed", error);
		return NextResponse.json(
			{ error: "Failed to report marketplace post" },
			{ status: 500 }
		);
	}
}
