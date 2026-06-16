import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredFileObject } from "@/lib/rag/storage";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id } = await params;
		const file = await prisma.fileObject.findFirst({
			where: {
				id,
				userId: session.user.id,
				kind: "image",
			},
			select: {
				id: true,
				status: true,
				mimeType: true,
				sizeBytes: true,
				storageProvider: true,
				storageKey: true,
			},
		});

		if (!file) {
			return NextResponse.json(
				{
					error: "Attachment not found",
					errorCode: "ATTACHMENT_NOT_FOUND",
				},
				{ status: 404 }
			);
		}

		if (file.status !== "ready") {
			return NextResponse.json(
				{
					error: "Attachment is not ready",
					errorCode: "ATTACHMENT_NOT_READY",
				},
				{ status: 409 }
			);
		}

		const buffer = await readStoredFileObject(file);

		return new Response(buffer, {
			headers: {
				"Content-Type": file.mimeType,
				"Content-Length": String(buffer.byteLength),
				"Cache-Control": "private, max-age=300",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		logServerError("attachments", "content_fetch_failed", error);
		return NextResponse.json(
			{
				error: "Failed to fetch attachment content",
				errorCode: "ATTACHMENT_CONTENT_FETCH_FAILED",
			},
			{ status: 500 }
		);
	}
}
