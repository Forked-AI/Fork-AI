import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { proposeToolExecution } from "@/lib/tools/router";
import { checkToolExecuteRateLimit } from "@/lib/tools/http";
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const executeToolSchema = z
	.object({
		toolName: z.string().trim().min(1).max(120),
		input: z.unknown(),
		conversationId: z.string().trim().min(1).optional(),
		messageId: z.string().trim().min(1).optional(),
	})
	.strict();

function responseStatus(status: string) {
	return status === "pending_confirmation" ? 202 : 200;
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
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;

		const rateLimit = await checkToolExecuteRateLimit(
			request,
			session.user.id
		);
		if (!rateLimit.allowed) return rateLimit.response;

		const parsed = executeToolSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "tools:execute",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: parsed.data,
			},
			async () => {
				const result = await proposeToolExecution({
					toolName: parsed.data.toolName,
					input: parsed.data.input,
					context: {
						userId: session.user.id,
						organizationId:
							workspaceResult.workspace.organizationId,
						conversationId: parsed.data.conversationId ?? null,
						messageId: parsed.data.messageId ?? null,
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
					status: responseStatus(result.execution.status),
					resourceType: "tool_execution",
					resourceId: result.execution.id,
				};
			}
		);
	} catch (error) {
		logServerError("tools/execute", "execute_failed", error);
		return NextResponse.json(
			{ error: "Failed to execute tool" },
			{ status: 500 }
		);
	}
}
