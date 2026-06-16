import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import { skillCollectionItemSchema } from "@/lib/skills/catalog";
import {
	addSkillToCollection,
	removeSkillFromCollection,
} from "@/lib/skills/service";
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
		const rateLimit = await checkSkillMutationRateLimit(
			request,
			session.user.id,
			"collection-item-add"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = skillCollectionItemSchema.safeParse(
			await request.json()
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "skills:collection:item:add",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: {
					collectionId: id,
					installedSkillId: parsed.data.installedSkillId,
				},
			},
			async () => {
				const item = await addSkillToCollection({
					userId: session.user.id,
					collectionId: id,
					installedSkillId: parsed.data.installedSkillId,
				});
				if (!item) {
					return {
						body: {
							error: "Collection or installed skill not found",
						},
						status: 404,
					};
				}

				return {
					body: { item },
					status: 201,
					resourceType: "skill_collection_item",
					resourceId: item.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/collections/items", "add_failed", error);
		return NextResponse.json(
			{ error: "Failed to add skill to collection" },
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
			"collection-item-remove"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = skillCollectionItemSchema.safeParse(
			await request.json()
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "skills:collection:item:remove",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: {
					collectionId: id,
					installedSkillId: parsed.data.installedSkillId,
				},
			},
			async () => {
				const removed = await removeSkillFromCollection({
					userId: session.user.id,
					collectionId: id,
					installedSkillId: parsed.data.installedSkillId,
				});
				if (!removed) {
					return {
						body: { error: "Collection item not found" },
						status: 404,
					};
				}

				return { body: { ok: true } };
			}
		);
	} catch (error) {
		logServerError("skills/collections/items", "remove_failed", error);
		return NextResponse.json(
			{ error: "Failed to remove skill from collection" },
			{ status: 500 }
		);
	}
}
