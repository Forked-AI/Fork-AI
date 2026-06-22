import { auth } from "@/lib/auth";
import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import {
	deleteMarketplacePost,
	getMarketplacePostForOwner,
	updateMarketplacePost,
	updateMarketplacePostSchema,
} from "@/lib/marketplace/posts";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function GET(
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

		const { id } = await params;
		const post = await getMarketplacePostForOwner({
			userId: session.user.id,
			postId: id,
		});
		if (!post) {
			return NextResponse.json(
				{ error: "Marketplace post not found" },
				{ status: 404 }
			);
		}
		return NextResponse.json({ post });
	} catch (error) {
		logServerError("marketplace/posts", "get_owner_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch marketplace post" },
			{ status: 500 }
		);
	}
}

export async function PATCH(
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
			bucket: "marketplace-post-update",
			maxRequests: 30,
			windowSeconds: 60,
			identityParts: [session.user.id],
			error: "Too many marketplace post updates. Please try again later.",
			scope: "marketplace/posts",
		});
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = updateMarketplacePostSchema.safeParse(
			await request.json()
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id } = await params;
		const result = await updateMarketplacePost({
			userId: session.user.id,
			postId: id,
			input: parsed.data,
		});
		if (!result) {
			return NextResponse.json(
				{ error: "Marketplace post not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(
			{ post: result.post, error: result.error ?? undefined },
			{ status: result.status }
		);
	} catch (error) {
		logServerError("marketplace/posts", "update_failed", error);
		return NextResponse.json(
			{ error: "Failed to update marketplace post" },
			{ status: 500 }
		);
	}
}

export async function DELETE(
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

		const { id } = await params;
		const deleted = await deleteMarketplacePost({
			userId: session.user.id,
			postId: id,
		});
		if (!deleted) {
			return NextResponse.json(
				{ error: "Marketplace post not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		logServerError("marketplace/posts", "delete_failed", error);
		return NextResponse.json(
			{ error: "Failed to delete marketplace post" },
			{ status: 500 }
		);
	}
}
