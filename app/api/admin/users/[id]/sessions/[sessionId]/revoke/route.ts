import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import { betterAuthAdminApi } from "@/lib/admin-plugin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string; sessionId: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id, sessionId } = await params;
		if (id === admin.session.user.id) {
			return NextResponse.json(
				{ error: "Admins cannot revoke their own sessions." },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:revoke-session",
				actorKey: `admin:${admin.session.user.id}`,
				requestInput: { id, sessionId },
			},
			async () => {
				const session = await prisma.session.findUnique({
					where: { id: sessionId },
					select: { id: true, userId: true, token: true },
				});
				if (!session || session.userId !== id) {
					return {
						body: { error: "Session not found" },
						status: 404,
					};
				}

				await betterAuthAdminApi().revokeUserSession({
					body: { sessionToken: session.token },
					headers: request.headers,
				});
				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "user.session.revoke",
					targetType: "session",
					targetId: sessionId,
					request,
					metadata: { userId: id },
				});

				return {
					body: { success: true },
					resourceType: "session",
					resourceId: sessionId,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "revoke_session_failed", error);
		return NextResponse.json(
			{ error: "Failed to revoke user session" },
			{ status: 500 }
		);
	}
}
