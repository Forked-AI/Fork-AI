import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import { installSkill, listInstalledSkills } from "@/lib/skills/service";
import { installSkillSchema } from "@/lib/skills/catalog";
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
		const installedSkills = await listInstalledSkills({
			userId: session.user.id,
		});
		return NextResponse.json({ installedSkills });
	} catch (error) {
		logServerError("skills/installed", "list_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch installed skills" },
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
			"install"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = installSkillSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		return withJsonIdempotency(
			request,
			{
				scope: "skills:install",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: parsed.data,
			},
			async () => {
				const installedSkill = await installSkill({
					userId: session.user.id,
					templateId: parsed.data.templateId,
					versionId: parsed.data.versionId,
				});

				if (!installedSkill) {
					return {
						body: {
							error: "Skill template not found",
							errorCode: "SKILL_TEMPLATE_NOT_FOUND",
						},
						status: 404,
					};
				}

				return {
					body: { installedSkill },
					status: 201,
					resourceType: "installed_skill",
					resourceId: installedSkill.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/installed", "install_failed", error);
		return NextResponse.json(
			{ error: "Failed to install skill" },
			{ status: 500 }
		);
	}
}
