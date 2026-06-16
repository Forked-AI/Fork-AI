import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import {
	betterAuthAdminApi,
	toSafeAdminUser,
	unwrapAdminUser,
} from "@/lib/admin-plugin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
	search: z.string().trim().max(320).optional(),
	role: z.enum(["user", "admin"]).optional(),
	banned: z.enum(["true", "false"]).optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

const createUserSchema = z.object({
	email: z.string().trim().email(),
	name: z.string().trim().min(1).max(120),
	password: z.string().min(8).max(200),
	role: z.enum(["user", "admin"]).default("user"),
});

function monthWindow() {
	const now = new Date();
	return {
		windowStart: new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
		),
		windowEnd: new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
		),
	};
}

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const url = new URL(request.url);
		const parsed = querySchema.safeParse(
			Object.fromEntries(url.searchParams.entries())
		);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid query", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const skip = (parsed.data.page - 1) * parsed.data.limit;
		const { windowStart, windowEnd } = monthWindow();

		const pluginQuery: Record<string, unknown> = {
			limit: parsed.data.limit,
			offset: skip,
			sortBy: "createdAt",
			sortDirection: "desc",
		};
		if (parsed.data.search) {
			pluginQuery.searchValue = parsed.data.search;
			pluginQuery.searchField = parsed.data.search.includes("@")
				? "email"
				: "name";
			pluginQuery.searchOperator = "contains";
		}
		if (parsed.data.role) {
			pluginQuery.filterField = "role";
			pluginQuery.filterValue = parsed.data.role;
			pluginQuery.filterOperator = "eq";
		} else if (parsed.data.banned) {
			pluginQuery.filterField = "banned";
			pluginQuery.filterValue = parsed.data.banned === "true";
			pluginQuery.filterOperator = "eq";
		}

		const pluginResult = await betterAuthAdminApi().listUsers({
			query: pluginQuery,
			headers: request.headers,
		});
		const safeUsers = (pluginResult.users ?? [])
			.map(toSafeAdminUser)
			.filter((user): user is NonNullable<typeof user> => Boolean(user))
			.filter((user) =>
				parsed.data.banned && parsed.data.role
					? user.banned === (parsed.data.banned === "true")
					: true
			);
		const users = await prisma.user.findMany({
			where: { id: { in: safeUsers.map((user) => user.id) } },
			select: {
				id: true,
				stripeCustomerId: true,
				_count: {
					select: {
						sessions: true,
						conversations: true,
						sharedConversations: true,
						fileObjects: true,
						usageEvents: true,
						moderationEvents: true,
						abuseSignals: true,
					},
				},
			},
		});
		const metadataByUser = new Map(users.map((user) => [user.id, user]));

		const ledgers = await prisma.quotaLedger.findMany({
			where: {
				subjectType: "user",
				subjectId: { in: safeUsers.map((user) => user.id) },
				windowStart,
				windowEnd,
			},
			select: {
				subjectId: true,
				usedTokens: true,
				usedUsd: true,
			},
		});
		const ledgerByUser = new Map(
			ledgers.map((ledger) => [ledger.subjectId, ledger])
		);

		return NextResponse.json({
			users: safeUsers.map((user) => {
				const ledger = ledgerByUser.get(user.id);
				const metadata = metadataByUser.get(user.id);
				return {
					...user,
					banned: user.banned ?? false,
					stripeCustomerId: metadata?.stripeCustomerId ?? null,
					_count: metadata?._count ?? {
						sessions: 0,
						conversations: 0,
						sharedConversations: 0,
						fileObjects: 0,
						usageEvents: 0,
						moderationEvents: 0,
						abuseSignals: 0,
					},
					currentMonthUsage: {
						usedTokens: ledger?.usedTokens ?? 0,
						usedUsd: ledger?.usedUsd?.toString() ?? "0",
					},
				};
			}),
			pagination: {
				page: parsed.data.page,
				limit: parsed.data.limit,
				total: pluginResult.total ?? safeUsers.length,
				totalPages: Math.ceil(
					(pluginResult.total ?? safeUsers.length) / parsed.data.limit
				),
			},
		});
	} catch (error) {
		logServerError("admin/users", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch users" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const body = await request.json();
		const parsed = createUserSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid body", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:create",
				actorKey: `admin:${admin.session.user.id}`,
				requestInput: parsed.data,
			},
			async () => {
				const created = unwrapAdminUser(
					await betterAuthAdminApi().createUser({
						body: parsed.data,
						headers: request.headers,
					})
				);
				const safeUser = toSafeAdminUser(created);
				if (!safeUser) {
					return {
						body: { error: "Failed to create user" },
						status: 500,
					};
				}

				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "user.create",
					targetType: "user",
					targetId: safeUser.id,
					request,
					metadata: {
						role: safeUser.role,
						email: safeUser.email,
					},
				});

				return {
					body: { user: safeUser },
					resourceType: "user",
					resourceId: safeUser.id,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "create_failed", error);
		return NextResponse.json(
			{ error: "Failed to create user" },
			{ status: 500 }
		);
	}
}
