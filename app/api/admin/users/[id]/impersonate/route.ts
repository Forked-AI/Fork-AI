import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import { betterAuthAdminApi, toSafeAdminUser } from "@/lib/admin-plugin";
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
				{ error: "Admins cannot impersonate themselves." },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:impersonate",
				actorKey: `admin:${admin.session.user.id}`,
				requestInput: { id },
			},
			async () => {
				const target = await prisma.user.findUnique({
					where: { id },
					select: { id: true, role: true },
				});
				if (!target) {
					return { body: { error: "User not found" }, status: 404 };
				}
				if (target.role === "admin") {
					return {
						body: { error: "Admin users cannot be impersonated." },
						status: 403,
					};
				}

				const result = await betterAuthAdminApi().impersonateUser({
					body: { userId: id },
					headers: request.headers,
				});
				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "user.impersonate",
					targetType: "user",
					targetId: id,
					request,
					metadata: { targetRole: target.role },
				});

				return {
					body: { user: toSafeAdminUser(result.user) },
					resourceType: "user",
					resourceId: id,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "impersonate_failed", error);
		return NextResponse.json(
			{ error: "Failed to impersonate user" },
			{ status: 500 }
		);
	}
}
