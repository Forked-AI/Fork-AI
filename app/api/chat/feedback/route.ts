import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { messageId, type, reasons, comment } = body;

		if (!messageId || !type || !["good", "bad"].includes(type)) {
			return NextResponse.json(
				{ error: "Invalid input" },
				{ status: 400 }
			);
		}

		// Store feedback in database
		await prisma.messageFeedback.create({
			data: {
				messageId,
				userId: session.user.id,
				type,
				reasons: reasons || [],
				comment: comment || "",
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Feedback API error:", error);
		return NextResponse.json(
			{ error: "Failed to save feedback" },
			{ status: 500 }
		);
	}
}
