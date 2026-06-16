import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { checkSkillMutationRateLimit } from "@/lib/skills/http";
import {
	bindConversationSkill,
	listConversationSkills,
	unbindConversationSkill,
} from "@/lib/skills/service";
import { NextResponse } from "next/server";
import { z } from "zod";

const bindSkillSchema = z.object({
	installedSkillId: z.string().trim().min(1).max(120),
});

const deleteSkillSchema = z.object({
	bindingId: z.string().trim().min(1).max(120),
});

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
		const { id: conversationId } = await params;
		const bindings = await listConversationSkills({
			userId: session.user.id,
			conversationId,
		});

		return NextResponse.json({ bindings });
	} catch (error) {
		logServerError("conversation/skills", "list_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation skills" },
			{ status: 500 }
		);
	}
}

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
			"conversation-bind"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = bindSkillSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id: conversationId } = await params;
		return withJsonIdempotency(
			request,
			{
				scope: "conversation:skill:bind",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: {
					conversationId,
					installedSkillId: parsed.data.installedSkillId,
				},
			},
			async () => {
				const binding = await bindConversationSkill({
					userId: session.user.id,
					conversationId,
					installedSkillId: parsed.data.installedSkillId,
				});

				if (!binding) {
					return {
						body: {
							error: "Conversation or installed skill not found",
							errorCode: "SKILL_BINDING_NOT_FOUND",
						},
						status: 404,
					};
				}

				return {
					body: { binding },
					status: 201,
					resourceType: "conversation_skill_binding",
					resourceId: binding.id,
				};
			}
		);
	} catch (error) {
		logServerError("conversation/skills", "bind_failed", error);
		return NextResponse.json(
			{ error: "Failed to bind conversation skill" },
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
			"conversation-unbind"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const { id: conversationId } = await params;
		const parsed = deleteSkillSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		return withJsonIdempotency(
			request,
			{
				scope: "conversation:skill:unbind",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: {
					conversationId,
					bindingId: parsed.data.bindingId,
				},
			},
			async () => {
				const removed = await unbindConversationSkill({
					userId: session.user.id,
					bindingId: parsed.data.bindingId,
				});

				if (!removed) {
					return {
						body: { error: "Skill binding not found" },
						status: 404,
					};
				}

				return { body: { ok: true } };
			}
		);
	} catch (error) {
		logServerError("conversation/skills", "delete_failed", error);
		return NextResponse.json(
			{ error: "Failed to remove conversation skill" },
			{ status: 500 }
		);
	}
}
