import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { updateSkillCollectionSchema } from "@/lib/skills/catalog";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import {
	deleteSkillCollection,
	updateSkillCollection,
} from "@/lib/skills/service";
import { NextResponse } from "next/server";

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
		const rateLimit = await checkSkillMutationRateLimit(
			request,
			session.user.id,
			"collection-update"
		);
		if (!rateLimit.allowed) return rateLimit.response;
		const parsed = updateSkillCollectionSchema.safeParse(
			await request.json()
		);
		if (!parsed.success || Object.keys(parsed.data).length === 0) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error?.flatten() },
				{ status: 400 }
			);
		}
		const { id } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "skills:collection:update",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { collectionId: id, ...parsed.data },
			},
			async () => {
				const collection = await updateSkillCollection({
					userId: session.user.id,
					collectionId: id,
					name: parsed.data.name,
					description: parsed.data.description,
				});
				if (!collection) {
					return {
						body: { error: "Skill collection not found" },
						status: 404,
					};
				}
				return {
					body: { collection },
					resourceType: "skill_collection",
					resourceId: collection.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/collections", "update_failed", error);
		return NextResponse.json(
			{ error: "Failed to update skill collection" },
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
		const rateLimit = await checkSkillMutationRateLimit(
			request,
			session.user.id,
			"collection-delete"
		);
		if (!rateLimit.allowed) return rateLimit.response;
		const { id } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "skills:collection:delete",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { collectionId: id },
			},
			async () => {
				const deleted = await deleteSkillCollection({
					userId: session.user.id,
					collectionId: id,
				});
				if (!deleted) {
					return {
						body: {
							error: "Skill collection not found or cannot be deleted",
						},
						status: 404,
					};
				}
				return { body: { ok: true } };
			}
		);
	} catch (error) {
		logServerError("skills/collections", "delete_failed", error);
		return NextResponse.json(
			{ error: "Failed to delete skill collection" },
			{ status: 500 }
		);
	}
}
