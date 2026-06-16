import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { confirmToolExecution } from "@/lib/tools/router";
import { checkToolDecisionRateLimit } from "@/lib/tools/http";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const confirmToolSchema = z.object({ input: z.unknown() }).strict();

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
		const rateLimit = await checkToolDecisionRateLimit(
			request,
			session.user.id,
			"confirm"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = confirmToolSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const { id } = await params;
		return await withJsonIdempotency(
			request,
			{
				scope: "tools:confirm",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { executionId: id, body: parsed.data },
			},
			async () => {
				const result = await confirmToolExecution({
					executionId: id,
					input: parsed.data.input,
					context: {
						userId: session.user.id,
						organizationId: null,
					},
				});

				if (!result.ok) {
					return {
						body: {
							error: result.error,
							errorCode: result.errorCode,
							execution: result.execution ?? null,
						},
						status: result.status,
						resourceType: "tool_execution",
						resourceId: result.execution?.id,
					};
				}

				return {
					body: { execution: result.execution },
					resourceType: "tool_execution",
					resourceId: result.execution.id,
				};
			}
		);
	} catch (error) {
		logServerError("tools/confirm", "confirm_failed", error);
		return NextResponse.json(
			{ error: "Failed to confirm tool execution" },
			{ status: 500 }
		);
	}
}
