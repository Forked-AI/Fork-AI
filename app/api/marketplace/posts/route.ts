import { auth } from "@/lib/auth";
import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import {
	createMarketplacePost,
	createMarketplacePostSchema,
	listPublicMarketplacePosts,
} from "@/lib/marketplace/posts";
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const rateLimit = await checkRequestRateLimit(request, {
			bucket: "marketplace-post-list",
			maxRequests: 120,
			windowSeconds: 60,
			error: "Too many marketplace requests. Please try again later.",
			scope: "marketplace/posts",
		});
		if (!rateLimit.allowed) return rateLimit.response;

		const session = await auth.api.getSession({ headers: request.headers });
		const posts = await listPublicMarketplacePosts({
			viewerUserId: session?.user?.id ?? null,
		});
		return NextResponse.json({ posts });
	} catch (error) {
		logServerError("marketplace/posts", "list_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch marketplace posts" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const rateLimit = await checkRequestRateLimit(request, {
			bucket: "marketplace-post-create",
			maxRequests: 20,
			windowSeconds: 60,
			identityParts: [session.user.id],
			error: "Too many marketplace post requests. Please try again later.",
			scope: "marketplace/posts",
		});
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = createMarketplacePostSchema.safeParse(
			await request.json()
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;

		return withJsonIdempotency(
			request,
			{
				scope: "marketplace:post:create",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: {
					...parsed.data,
					organizationId: workspaceResult.workspace.organizationId,
				},
			},
			async () => {
				const result = await createMarketplacePost({
					userId: session.user.id,
					organizationId: workspaceResult.workspace.organizationId,
					input: parsed.data,
				});
				if (!result) {
					return {
						body: { error: "Marketplace post source not found" },
						status: 404,
					};
				}

				return {
					body: {
						post: result.post ?? null,
						error: result.error ?? undefined,
					},
					status: result.status,
					resourceType: "marketplace_post",
					resourceId: result.post?.id,
				};
			}
		);
	} catch (error) {
		logServerError("marketplace/posts", "create_failed", error);
		return NextResponse.json(
			{ error: "Failed to create marketplace post" },
			{ status: 500 }
		);
	}
}
