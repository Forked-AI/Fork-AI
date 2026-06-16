import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { cancelToolExecution } from "@/lib/tools/router";
import { checkToolDecisionRateLimit } from "@/lib/tools/http";
import { logServerError } from "@/lib/server-safe-log";
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
		const rateLimit = await checkToolDecisionRateLimit(
			request,
			session.user.id,
			"cancel"
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const { id } = await params;
		return await withJsonIdempotency(
			request,
			{
				scope: "tools:cancel",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { executionId: id },
			},
			async () => {
				const result = await cancelToolExecution({
					executionId: id,
					context: { userId: session.user.id },
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
		logServerError("tools/cancel", "cancel_failed", error);
		return NextResponse.json(
			{ error: "Failed to cancel tool execution" },
			{ status: 500 }
		);
	}
}
