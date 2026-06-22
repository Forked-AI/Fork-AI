import { auth } from "@/lib/auth";
import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import {
	marketplaceEngagementSchema,
	setMarketplacePostEngagement,
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
			bucket: "marketplace-post-engagement",
			maxRequests: 60,
			windowSeconds: 60,
			identityParts: [session.user.id],
			error: "Too many marketplace engagement requests.",
			scope: "marketplace/posts/engagement",
		});
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = marketplaceEngagementSchema.safeParse(
			await request.json()
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id } = await params;
		const post = await setMarketplacePostEngagement({
			userId: session.user.id,
			postId: id,
			type: parsed.data.type,
			enabled: parsed.data.enabled,
		});
		if (!post) {
			return NextResponse.json(
				{ error: "Marketplace post not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ post });
	} catch (error) {
		logServerError("marketplace/posts", "engagement_failed", error);
		return NextResponse.json(
			{ error: "Failed to update marketplace engagement" },
			{ status: 500 }
		);
	}
}
