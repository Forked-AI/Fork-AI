import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import { upgradeInstalledSkill } from "@/lib/skills/service";
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
			"install-upgrade"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const { id } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "skills:install:upgrade",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { installedSkillId: id },
			},
			async () => {
				const installedSkill = await upgradeInstalledSkill({
					userId: session.user.id,
					installedSkillId: id,
				});
				if (!installedSkill) {
					return {
						body: {
							error: "Installed skill or current version not found",
						},
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
		logServerError("skills/installed", "upgrade_failed", error);
		return NextResponse.json(
			{ error: "Failed to update installed skill" },
			{ status: 500 }
		);
	}
}
