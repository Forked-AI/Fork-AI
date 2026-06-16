import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import { betterAuthAdminApi } from "@/lib/admin-plugin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const passwordSchema = z.object({
	newPassword: z.string().min(8).max(200),
});

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id } = await params;
		const parsed = passwordSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid body", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:set-password",
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

				await betterAuthAdminApi().setUserPassword({
					body: { userId: id, newPassword: parsed.data.newPassword },
					headers: request.headers,
				});
				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "user.set_password",
					targetType: "user",
					targetId: id,
					request,
					metadata: { passwordChanged: true },
				});

				return {
					body: { success: true },
					resourceType: "user",
					resourceId: id,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "set_password_failed", error);
		return NextResponse.json(
			{ error: "Failed to set user password" },
			{ status: 500 }
		);
	}
}
