import { requireAdminSession } from "@/lib/admin";
import { betterAuthAdminApi, toSafeAdminSession } from "@/lib/admin-plugin";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id } = await params;
		const result = await betterAuthAdminApi().listUserSessions({
			body: { userId: id },
			headers: request.headers,
		});
		const sessions = (result.sessions ?? [])
			.map(toSafeAdminSession)
			.filter((session): session is NonNullable<typeof session> =>
				Boolean(session)
			);

		return NextResponse.json({ sessions });
	} catch (error) {
		logServerError("admin/users", "sessions_failed", error);
		return NextResponse.json(
			{ error: "Failed to list user sessions" },
			{ status: 500 }
		);
	}
}
