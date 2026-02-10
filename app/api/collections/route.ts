import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCollectionSchema = z.object({
	name: z.string().min(1, "Name is required").max(50, "Name too long"),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
});

export async function GET() {
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

		const userId = session.user.id;

		let collections = await prisma.collection.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			include: {
				_count: {
					select: { conversations: true },
				},
			},
		});

		// Auto-create "Uncategorized" if user has no collections
		if (collections.length === 0) {
			const defaultCollection = await prisma.collection.create({
				data: {
					name: "Uncategorized",
					color: "#95A5A6",
					userId,
					isDefault: true,
				},
				include: {
					_count: {
						select: { conversations: true },
					},
				},
			});
			collections = [defaultCollection];
		}

		return NextResponse.json({ collections });
	} catch (error) {
		console.error("Error fetching collections:", error);
		return NextResponse.json(
			{ error: "Failed to fetch collections" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
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

		const userId = session.user.id;
		const body = await request.json();

		const result = createCollectionSchema.safeParse(body);
		if (!result.success) {
			return NextResponse.json(
				{ error: result.error.errors[0].message },
				{ status: 400 }
			);
		}

		const { name, color } = result.data;

		const collection = await prisma.collection.create({
			data: {
				name,
				color,
				userId,
				isDefault: false,
			},
			include: {
				_count: {
					select: { conversations: true },
				},
			},
		});

		return NextResponse.json({ collection }, { status: 201 });
	} catch (error) {
		console.error("Error creating collection:", error);
		return NextResponse.json(
			{ error: "Failed to create collection" },
			{ status: 500 }
		);
	}
}
