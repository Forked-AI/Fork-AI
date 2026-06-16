import { auth } from "@/lib/auth";
import {
	getRequestIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { deleteStoredFileObjects } from "@/lib/rag/storage";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const deleteAccountSchema = z.object({
	confirmation: z.literal("DELETE"),
});

export async function POST(request: Request) {
	try {
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

		return await withJsonIdempotency(
			request,
			{
				scope: "account:delete",
				actorKey: getRequestIdempotencyActorKey(
					request,
					"account-delete"
				),
				requestInput: parsed.data,
				ttlSeconds: 7 * 24 * 60 * 60,
			},
			async () => {
				const session = await auth.api.getSession({
					headers: await headers(),
				});
				if (!session?.user?.id) {
					return {
						body: { error: "Unauthorized" },
						status: 401,
					};
				}

				const fileObjects = await prisma.fileObject.findMany({
					where: { userId: session.user.id },
					select: {
						storageProvider: true,
						storageKey: true,
					},
				});
				await deleteStoredFileObjects(fileObjects);

				await prisma.$transaction([
					prisma.quotaLedger.deleteMany({
						where: {
							subjectType: "user",
							subjectId: session.user.id,
						},
					}),
					prisma.user.delete({
						where: { id: session.user.id },
					}),
				]);

				logServerInfo("account/delete", "deleted", {
					status: "completed",
				});

				return {
					body: {
						success: true,
						status: "deleted",
					},
					resourceType: "user",
					resourceId: session.user.id,
				};
			}
		);
	} catch (error) {
		logServerError("account/delete", "delete_failed", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
