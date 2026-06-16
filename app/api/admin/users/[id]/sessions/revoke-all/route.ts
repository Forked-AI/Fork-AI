import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import { betterAuthAdminApi } from "@/lib/admin-plugin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id } = await params;
		if (id === admin.session.user.id) {
			return NextResponse.json(
				{ error: "Admins cannot revoke all of their own sessions." },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:revoke-sessions",
				actorKey: `admin:${admin.session.user.id}`,
				requestInput: { id },
			},
			async () => {
				const user = await prisma.user.findUnique({
					where: { id },
					select: { id: true },
				});
				if (!user) {
					return { body: { error: "User not found" }, status: 404 };
				}

				await betterAuthAdminApi().revokeUserSessions({
					body: { userId: id },
					headers: request.headers,
				});
				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "user.sessions.revoke_all",
					targetType: "user",
					targetId: id,
					request,
					metadata: { allSessions: true },
				});

				return {
					body: { success: true },
					resourceType: "user",
					resourceId: id,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "revoke_sessions_failed", error);
		return NextResponse.json(
			{ error: "Failed to revoke user sessions" },
			{ status: 500 }
		);
	}
}
