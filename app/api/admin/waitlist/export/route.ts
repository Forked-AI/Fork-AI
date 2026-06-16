import {
	getIdempotencyKey,
	recordAdminAuditEvent,
	requireAdminSession,
} from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	if (!getIdempotencyKey(request)) {
		return NextResponse.json(
			{
				error: "Idempotency-Key header is required.",
				errorCode: "IDEMPOTENCY_KEY_REQUIRED",
			},
			{ status: 400 }
		);
	}

	try {
		// Get all entries for export
		const entries = await prisma.waitlistEntry.findMany({
			orderBy: { createdAt: "desc" },
		});

		// Create CSV content
		const csvHeaders = "ID,Email,Signed Up At\n";
		const csvRows = entries
			.map((entry) => {
				const date = new Date(entry.createdAt).toISOString();
				return `${entry.id},${entry.email},${date}`;
			})
			.join("\n");

		const csv = csvHeaders + csvRows;

		await recordAdminAuditEvent({
			actorId: admin.session.user.id,
			action: "waitlist.export",
			targetType: "waitlist",
			request,
			metadata: { rowCount: entries.length },
		});

		// Return as downloadable CSV
		return new NextResponse(csv, {
			status: 200,
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="waitlist-export-${
					new Date().toISOString().split("T")[0]
				}.csv"`,
			},
		});
	} catch (error) {
		logServerError("admin/waitlist", "export_failed", error);
		return NextResponse.json(
			{ error: "Failed to export waitlist" },
			{ status: 500 }
		);
	}
}
