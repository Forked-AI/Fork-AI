import {
	generateAccountExportFile,
	normalizeAccountExportFormat,
} from "@/lib/account-export";
import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { enqueueAccountExportJob } from "@/lib/queue/account-export";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const url = new URL(request.url);
		const format = normalizeAccountExportFormat(
			url.searchParams.get("format")
		);
		const file = await generateAccountExportFile(session.user.id, format);

		logServerInfo("account/export", "generated", {
			format,
			userId: session.user.id,
		});

		return new Response(file.content, {
			status: 200,
			headers: {
				"Content-Type": file.contentType,
				"Content-Disposition": `attachment; filename="${file.filename}"`,
			},
		});
	} catch (error) {
		logServerError("account/export", "generate_failed", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json().catch(() => ({}));
		const format = normalizeAccountExportFormat(body?.format);
		const userId = session.user.id;

		return await withJsonIdempotency(
			request,
			{
				scope: "account:export",
				actorKey: getUserIdempotencyActorKey(userId),
				requestInput: { format },
			},
			async () => {
				const job = await enqueueAccountExportJob({ userId, format });

				return {
					body: {
						status: "queued",
						jobId: String(job.id),
						format,
					},
					resourceType: "account_export_job",
					resourceId: String(job.id),
				};
			}
		);
	} catch (error) {
		logServerError("account/export", "queue_failed", error);
		return NextResponse.json(
			{ error: "Failed to queue account export" },
			{ status: 500 }
		);
	}
}
