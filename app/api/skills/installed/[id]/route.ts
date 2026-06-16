import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import { updateInstalledSkillSchema } from "@/lib/skills/catalog";
import {
	deleteInstalledSkill,
	updateInstalledSkill,
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
			"install-update"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = updateInstalledSkillSchema.safeParse(
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
				scope: "skills:install:update",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { installedSkillId: id, ...parsed.data },
			},
			async () => {
				const installedSkill = await updateInstalledSkill({
					userId: session.user.id,
					installedSkillId: id,
					alias: parsed.data.alias,
					pinned: parsed.data.pinned,
					enabled: parsed.data.enabled,
					defaultScope: parsed.data.defaultScope,
					settings: parsed.data.settings as Record<
						string,
						unknown
					> | null,
				});

				if (!installedSkill) {
					return {
						body: { error: "Installed skill not found" },
						status: 404,
					};
				}

				return {
					body: { installedSkill },
					resourceType: "installed_skill",
					resourceId: installedSkill.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/installed", "update_failed", error);
		return NextResponse.json(
			{ error: "Failed to update installed skill" },
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
			"install-delete"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const { id } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "skills:install:delete",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { installedSkillId: id },
			},
			async () => {
				const deleted = await deleteInstalledSkill({
					userId: session.user.id,
					installedSkillId: id,
				});
				if (!deleted) {
					return {
						body: { error: "Installed skill not found" },
						status: 404,
					};
				}

				return { body: { ok: true } };
			}
		);
	} catch (error) {
		logServerError("skills/installed", "delete_failed", error);
		return NextResponse.json(
			{ error: "Failed to delete installed skill" },
			{ status: 500 }
		);
	}
}
