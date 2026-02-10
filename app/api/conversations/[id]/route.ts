import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const moveConversationSchema = z.object({
	collectionId: z.string().nullable(),
});

const updateConversationSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	collectionId: z.string().nullable().optional(),
});

// GET - Fetch a single conversation with all messages
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Please sign in to save conversations" },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const { id: conversationId } = await params;

		const conversation = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				userId: userId,
			},
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						role: true,
						content: true,
						model: true,
						promptTokens: true,
						completionTokens: true,
						isError: true,
						createdAt: true,
						parentMessageId: true,
					},
				},
				collection: {
					select: {
						id: true,
						name: true,
						color: true,
					},
				},
			},
		});

		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ conversation });
	} catch (error) {
		console.error("Error fetching conversation:", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation" },
			{ status: 500 }
		);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Please sign in to save conversations" },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const { id: conversationId } = await params;
		const body = await request.json();

		const result = moveConversationSchema.safeParse(body);
		if (!result.success) {
			return NextResponse.json(
				{ error: result.error.errors[0].message },
				{ status: 400 }
			);
		}

		const { collectionId } = result.data;

		// Check conversation ownership
		const existing = await prisma.conversation.findFirst({
			where: { id: conversationId, userId },
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		// If moving to a collection, verify collection ownership
		if (collectionId) {
			const collection = await prisma.collection.findFirst({
				where: { id: collectionId, userId },
			});

			if (!collection) {
				return NextResponse.json(
					{ error: "Collection not found" },
					{ status: 404 }
				);
			}
		}

		// Update conversation
		const conversation = await prisma.conversation.update({
			where: { id: conversationId },
			data: { collectionId },
		});

		return NextResponse.json({ conversation });
	} catch (error) {
		console.error("Error moving conversation:", error);
		return NextResponse.json(
			{ error: "Failed to move conversation" },
			{ status: 500 }
		);
	}
}

// DELETE - Delete a conversation and all its messages
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Please sign in to save conversations" },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const { id: conversationId } = await params;

		// Check ownership
		const existing = await prisma.conversation.findFirst({
			where: { id: conversationId, userId },
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		// Delete conversation (messages cascade delete due to schema)
		await prisma.conversation.delete({
			where: { id: conversationId },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting conversation:", error);
		return NextResponse.json(
			{ error: "Failed to delete conversation" },
			{ status: 500 }
		);
	}
}
