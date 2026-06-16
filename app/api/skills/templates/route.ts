import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { createSkillTemplateSchema } from "@/lib/skills/catalog";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import {
	createCustomSkillTemplate,
	listSkillTemplates,
} from "@/lib/skills/service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	const templates = await listSkillTemplates({
		userId: session?.user?.id ?? null,
	});
	return NextResponse.json({ templates });
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
			"template-create"
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

		return withJsonIdempotency(
			request,
			{
				scope: "skills:template:create",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: parsed.data,
			},
			async () => {
				const template = await createCustomSkillTemplate({
					userId: session.user.id,
					input: parsed.data,
				});
				return {
					body: { template },
					status: 201,
					resourceType: "skill_template",
					resourceId: template.id,
				};
			}
		);
	} catch (error) {
		logServerError("skills/templates", "create_failed", error);
		return NextResponse.json(
			{ error: "Failed to create skill" },
			{ status: 500 }
		);
	}
}
