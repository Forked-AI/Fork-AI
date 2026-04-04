import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

// --- Types ---

export interface MessageSnapshot {
	id: string;
	role: "user" | "assistant";
	content: string; // may be "[Message redacted by author]" for redacted messages
	model?: string;
	createdAt: string; // ISO string
	orderIndex: number;
}

// --- Rate limiting for share creation (Redis-free fallback using DB count) ---

async function checkShareRateLimit(userId: string): Promise<boolean> {
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const recentShareCount = await prisma.sharedConversation.count({
		where: {
			createdBy: userId,
			createdAt: { gte: oneDayAgo },
		},
	});
	return recentShareCount < 10; // max 10 shares per 24h
}

// --- POST /api/chat/share — create a share link ---

const createShareSchema = z.object({
	conversationId: z.string().min(1),
	selectedMessageIds: z.array(z.string()).min(1).max(100),
	redactedMessageIds: z.array(z.string()).optional().default([]),
	title: z.string().max(200).optional(),
	expiresIn: z
		.union([z.literal(7), z.literal(30), z.null()])
		.optional()
		.default(null),
	allowDownload: z.boolean().optional().default(false),
	showTimestamps: z.boolean().optional().default(true),
	showModel: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
	try {
		// 1. Auth check
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}
		const userId = session.user.id;

		// 2. Parse body
		const body = await request.json();
		const parsed = createShareSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}
		const {
			conversationId,
			selectedMessageIds,
			redactedMessageIds,
			title,
			expiresIn,
			allowDownload,
			showTimestamps,
			showModel,
		} = parsed.data;

		// 3. Ownership check
		const conversation = await prisma.conversation.findFirst({
			where: { id: conversationId, userId },
		});
		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		// 4. Rate limit check
		const allowed = await checkShareRateLimit(userId);
		if (!allowed) {
			return NextResponse.json(
				{ error: "Rate limit exceeded. Max 10 shares per 24 hours." },
				{ status: 429 }
			);
		}

		// 5. Fetch & validate selected messages (must all belong to this conversation)
		const messages = await prisma.message.findMany({
			where: {
				id: { in: selectedMessageIds },
				conversationId,
			},
			select: {
				id: true,
				role: true,
				content: true,
				model: true,
				createdAt: true,
			},
		});

		if (messages.length !== selectedMessageIds.length) {
			return NextResponse.json(
				{
					error: "One or more message IDs are invalid or do not belong to this conversation",
				},
				{ status: 400 }
			);
		}

		// 6. Build snapshot - only user/assistant messages, frozen at share time
		const redactedSet = new Set(redactedMessageIds);
		const messageMap = new Map(messages.map((m) => [m.id, m]));
		const snapshots = selectedMessageIds.reduce<MessageSnapshot[]>(
			(acc, id, idx) => {
				const message = messageMap.get(id);
				if (
					!message ||
					(message.role !== "user" && message.role !== "assistant")
				) {
					return acc;
				}

				acc.push({
					id: message.id,
					role: message.role,
					content: redactedSet.has(message.id)
						? "[Message redacted by author]"
						: message.content,
					model: message.model ?? undefined,
					createdAt: message.createdAt.toISOString(),
					orderIndex: idx,
				});

				return acc;
			},
			[]
		);
		// Sort by createdAt to preserve conversation order
		snapshots.sort(
			(a, b) =>
				new Date(a.createdAt).getTime() -
				new Date(b.createdAt).getTime()
		);
		snapshots.forEach((snapshot, index) => {
			snapshot.orderIndex = index;
		});

		// 7. Generate unique share token (10 chars, URL-safe)
		const shareToken = generateToken();

		// 8. Compute expiry
		const expiresAt = expiresIn
			? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
			: null;

		// 9. Persist
		const share = await prisma.sharedConversation.create({
			data: {
				conversationId,
				shareToken,
				createdBy: userId,
				selectedMessageIds: JSON.stringify(selectedMessageIds),
				snapshotData: JSON.stringify(snapshots),
				title: title ?? conversation.title,
				expiresAt,
				allowDownload,
				showTimestamps,
				showModel,
			},
		});

		const origin =
			process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

		return NextResponse.json({
			shareToken: share.shareToken,
			shareUrl: `${origin}/share/${share.shareToken}`,
			expiresAt: share.expiresAt?.toISOString() ?? null,
			messageCount: snapshots.length,
		});
	} catch (error) {
		console.error("[POST /api/chat/share] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// --- GET /api/chat/share — list current user's active shares ---

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}
		const userId = session.user.id;
		const origin =
			process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

		const shares = await prisma.sharedConversation.findMany({
			where: { createdBy: userId, isActive: true },
			include: {
				conversation: { select: { title: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json({
			shares: shares.map((s) => ({
				id: s.id,
				shareToken: s.shareToken,
				shareUrl: `${origin}/share/${s.shareToken}`,
				title: s.title,
				conversationTitle: s.conversation.title,
				messageCount: (JSON.parse(s.selectedMessageIds) as string[])
					.length,
				accessCount: s.accessCount,
				expiresAt: s.expiresAt?.toISOString() ?? null,
				allowDownload: s.allowDownload,
				showTimestamps: s.showTimestamps,
				showModel: s.showModel,
				createdAt: s.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		console.error("[GET /api/chat/share] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// --- Helpers ---

function generateToken(): string {
	// URL-safe 10-char token from crypto
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	return Array.from(bytes)
		.map((b) => b.toString(36).padStart(2, "0"))
		.join("")
		.slice(0, 10);
}
