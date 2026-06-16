import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createConversationSchema = z.object({
	title: z.string().min(1).max(200).default("New Chat"),
	collectionId: z.string().optional(),
});

const listQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	collectionId: z.string().optional(),
	search: z.string().optional(),
	pinned: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
});

// GET - List user's conversations with pagination
export async function GET(request: Request) {
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
		const url = new URL(request.url);

		const queryResult = listQuerySchema.safeParse({
			page: url.searchParams.get("page") || 1,
			limit: url.searchParams.get("limit") || 20,
			collectionId: url.searchParams.get("collectionId") || undefined,
			search: url.searchParams.get("search") || undefined,
			pinned: url.searchParams.get("pinned") || undefined,
		});

		if (!queryResult.success) {
			return NextResponse.json(
				{ error: "Invalid query parameters" },
				{ status: 400 }
			);
		}

		const { page, limit, collectionId, search, pinned } = queryResult.data;
		const skip = (page - 1) * limit;

		// Build where clause with search support
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const where: any = { userId };

		if (collectionId !== undefined) {
			where.collectionId = collectionId === "null" ? null : collectionId;
		}

		if (pinned !== undefined) {
			where.isPinned = pinned;
		}

		// Add search conditions (search in title and message content)
		if (search && search.trim()) {
			const searchTerm = search.trim();
			where.OR = [
				{ title: { contains: searchTerm, mode: "insensitive" } },
				{
					messages: {
						some: {
							content: {
								contains: searchTerm,
								mode: "insensitive",
							},
						},
					},
				},
			];
		}

		const orderBy =
			pinned === true
				? [{ pinnedAt: "desc" as const }, { updatedAt: "desc" as const }]
				: [{ updatedAt: "desc" as const }];

		// Fetch conversations with last message preview
		const [conversations, total] = await Promise.all([
			prisma.conversation.findMany({
				where,
				orderBy,
				skip,
				take: limit,
				include: {
					messages: {
						orderBy: { createdAt: "desc" },
						take: 1,
						select: {
							id: true,
							role: true,
							content: true,
							createdAt: true,
						},
					},
					collection: {
						select: {
							id: true,
							name: true,
							color: true,
						},
					},
					_count: {
						select: { messages: true },
					},
				},
			}),
			prisma.conversation.count({ where }),
		]);

		// Transform response
		const formattedConversations = conversations.map((conv) => {
			const pinnedConversation = conv as typeof conv & {
				isPinned?: boolean;
				pinnedAt?: Date | null;
			};

			return {
				id: conv.id,
				title: conv.title,
				isPinned: pinnedConversation.isPinned ?? false,
				pinnedAt: pinnedConversation.pinnedAt?.toISOString() ?? null,
				lastMessage: conv.messages[0] || null,
				messageCount: conv._count.messages,
				collection: conv.collection,
				createdAt: conv.createdAt,
				updatedAt: conv.updatedAt,
			};
		});

		return NextResponse.json({
			conversations: formattedConversations,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
				hasMore: skip + conversations.length < total,
			},
		});
	} catch (error) {
		logServerError("conversations", "list_failed", error);
		return NextResponse.json(
			{ error: "Failed to list conversations" },
			{ status: 500 }
		);
	}
}

// POST - Create a new conversation
export async function POST(request: Request) {
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
		const body = await request.json();

		const result = createConversationSchema.safeParse(body);
		if (!result.success) {
			return NextResponse.json(
				{ error: result.error.errors[0].message },
				{ status: 400 }
			);
		}

		const { title, collectionId } = result.data;

		return await withJsonIdempotency(
			request,
			{
				scope: "conversations:create",
				actorKey: getUserIdempotencyActorKey(userId),
				requestInput: result.data,
			},
			async () => {
				// If collection specified, verify ownership
				if (collectionId) {
					const collection = await prisma.collection.findFirst({
						where: {
							id: collectionId,
							userId,
							isDefault: false,
						},
					});

					if (!collection) {
						return {
							body: { error: "Collection not found" },
							status: 404,
						};
					}
				}

				const conversation = await prisma.conversation.create({
					data: {
						title,
						userId,
						collectionId: collectionId || null,
					},
				});

				return {
					body: { conversation },
					status: 201,
					resourceType: "conversation",
					resourceId: conversation.id,
				};
			}
		);
	} catch (error) {
		logServerError("conversations", "create_failed", error);
		return NextResponse.json(
			{ error: "Failed to create conversation" },
			{ status: 500 }
		);
	}
}
