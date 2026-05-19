import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await prisma.sharedConversation.updateMany({
			where: {
				createdBy: session.user.id,
				isActive: true,
			},
			data: { isActive: false },
		});

		logServerInfo("account/shares", "revoked_all", {
			revokedCount: result.count,
		});

		return NextResponse.json({
			success: true,
			revokedCount: result.count,
		});
	} catch (error) {
		logServerError("account/shares", "revoke_all_failed", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
