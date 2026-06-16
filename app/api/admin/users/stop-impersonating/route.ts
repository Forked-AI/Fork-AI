import { recordAdminAuditEvent } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { betterAuthAdminApi, toSafeAdminUser } from "@/lib/admin-plugin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const impersonatedBy =
		(session.session as { impersonatedBy?: string | null } | undefined)
			?.impersonatedBy ?? null;
	if (!impersonatedBy) {
		return NextResponse.json(
			{ error: "Current session is not impersonating a user." },
			{ status: 400 }
		);
	}

	try {
		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:stop-impersonating",
				actorKey: `admin:${impersonatedBy}`,
				requestInput: {
					impersonatedUserId: session.user.id,
					impersonatedBy,
				},
			},
			async () => {
				const result = await betterAuthAdminApi().stopImpersonating({
					headers: request.headers,
				});
				await recordAdminAuditEvent({
					actorId: impersonatedBy,
					action: "user.stop_impersonating",
					targetType: "user",
					targetId: session.user.id,
					request,
					metadata: { returnedUserId: result.user?.id ?? null },
				});

				return {
					body: { user: toSafeAdminUser(result.user) },
					resourceType: "user",
					resourceId: session.user.id,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "stop_impersonating_failed", error);
		return NextResponse.json(
			{ error: "Failed to stop impersonating" },
			{ status: 500 }
		);
	}
}
