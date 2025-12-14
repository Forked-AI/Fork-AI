import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	// Check admin authentication
	if (!isAdminAuthenticated(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "20");
		const search = searchParams.get("search") || "";

		const skip = (page - 1) * limit;

		// Build where clause for search
		const where = search
			? { email: { contains: search, mode: "insensitive" as const } }
			: {};

		// Get total count for pagination
		const total = await prisma.waitlistEntry.count({ where });

		// Get paginated entries
		const entries = await prisma.waitlistEntry.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip,
			take: limit,
		});

		return NextResponse.json({
			entries,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Admin waitlist fetch error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch waitlist entries" },
			{ status: 500 }
		);
	}
}
