import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import { createSkillCollectionSchema } from "@/lib/skills/catalog";
import {
	createSkillCollection,
	listSkillCollections,
} from "@/lib/skills/service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}
		const collections = await listSkillCollections({
			userId: session.user.id,
		});
		return NextResponse.json({ collections });
	} catch (error) {
		logServerError("skills/collections", "list_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch skill collections" },
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
		const rateLimit = await checkSkillMutationRateLimit(
			request,
			session.user.id,
			"collection-create"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = createSkillCollectionSchema.safeParse(
			await request.json()
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		return withJsonIdempotency(
			request,
			{
				scope: "skills:collection:create",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: parsed.data,
			},
			async () => {
				const collection = await createSkillCollection({
					userId: session.user.id,
					name: parsed.data.name,
					description: parsed.data.description,
				});
				return {
					body: { collection },
					status: 201,
					resourceType: "skill_collection",
					resourceId: collection.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/collections", "create_failed", error);
		return NextResponse.json(
			{ error: "Failed to create skill collection" },
			{ status: 500 }
		);
	}
}
