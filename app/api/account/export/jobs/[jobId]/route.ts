import { auth } from "@/lib/auth";
import { accountExportQueue } from "@/lib/queue/account-export";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ jobId: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { jobId } = await params;
		const job = await accountExportQueue.getJob(jobId);

		if (!job || job.data.userId !== session.user.id) {
			return NextResponse.json(
				{ error: "Export job not found" },
				{ status: 404 }
			);
		}

		const state = await job.getState();

		if (state === "completed") {
			const file = job.returnvalue;

			if (!file?.content) {
				return NextResponse.json(
					{ error: "Export file is no longer available" },
					{ status: 410 }
				);
			}

			return new Response(file.content, {
				status: 200,
				headers: {
					"Content-Type": file.contentType,
					"Content-Disposition": `attachment; filename="${file.filename}"`,
				},
			});
		}

		if (state === "failed") {
			return NextResponse.json(
				{
					status: state,
					error: job.failedReason || "Export generation failed",
				},
				{ status: 500 }
			);
		}

		return NextResponse.json(
			{
				status: state,
				jobId,
			},
			{ status: 202 }
		);
	} catch (error) {
		logServerError("account/export", "fetch_job_failed", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
