import { auth } from "@/lib/auth";
import {
	buildRagCitations,
	retrieveDocumentContext,
} from "@/lib/rag/retrieval";
import { logServerError, logServerWarning } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const retrieveSchema = z.object({
	query: z.string().trim().min(1).max(4_000),
	fileIds: z.array(z.string().trim().min(1)).max(20).optional(),
	limit: z.number().int().positive().max(8).optional(),
});

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const parsed = retrieveSchema.safeParse(await request.json());
		if (!parsed.success) {
			logServerWarning("rag/retrieve", "validation_failed", {
				issues: parsed.error.issues.length,
			});
			return NextResponse.json(
				{
					error: "Invalid input",
					details: parsed.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const chunks = await retrieveDocumentContext({
			userId: session.user.id,
			query: parsed.data.query,
			fileIds: parsed.data.fileIds,
			limit: parsed.data.limit,
		});

		return NextResponse.json({
			chunks,
			citations: buildRagCitations(chunks),
		});
	} catch (error) {
		logServerError("rag/retrieve", "retrieve_failed", error);
		return NextResponse.json(
			{ error: "Failed to retrieve document context" },
			{ status: 500 }
		);
	}
}
