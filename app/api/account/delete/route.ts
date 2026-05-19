import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const deleteAccountSchema = z.object({
	confirmation: z.literal("DELETE"),
});

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = deleteAccountSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{
					error: 'Type "DELETE" to confirm account deletion.',
					errorCode: "ACCOUNT_DELETE_CONFIRMATION_REQUIRED",
				},
				{ status: 400 }
			);
		}

		await prisma.user.delete({
			where: { id: session.user.id },
		});

		logServerInfo("account/delete", "deleted", {
			status: "completed",
		});

		return NextResponse.json({
			success: true,
			status: "deleted",
		});
	} catch (error) {
		logServerError("account/delete", "delete_failed", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
