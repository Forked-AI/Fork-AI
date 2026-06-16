import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { createSkillTemplateSchema } from "@/lib/skills/catalog";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import { updateCustomSkillTemplate } from "@/lib/skills/service";
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
			"template-update"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = createSkillTemplateSchema.safeParse(
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
				scope: "skills:template:update",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { templateId: id, ...parsed.data },
			},
			async () => {
				const template = await updateCustomSkillTemplate({
					userId: session.user.id,
					templateId: id,
					input: parsed.data,
				});
				if (!template) {
					return {
						body: { error: "Skill template not found" },
						status: 404,
					};
				}
				return {
					body: { template },
					resourceType: "skill_template",
					resourceId: template.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/templates", "update_failed", error);
		return NextResponse.json(
			{ error: "Failed to update skill" },
			{ status: 500 }
		);
	}
}
