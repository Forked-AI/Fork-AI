import { recordAdminAuditEvent, requireAdminSession } from "@/lib/admin";
import {
	betterAuthAdminApi,
	secondsUntil,
	toSafeAdminSession,
	toSafeAdminUser,
	unwrapAdminUser,
} from "@/lib/admin-plugin";
import { withJsonIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
	role: z.enum(["user", "admin"]).optional(),
	banned: z.boolean().optional(),
	banReason: z.string().trim().max(500).nullable().optional(),
	banExpires: z.string().datetime().nullable().optional(),
});

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id } = await params;
		const pluginUser = toSafeAdminUser(
			unwrapAdminUser(
				await betterAuthAdminApi().getUser({
					query: { id },
					headers: request.headers,
				})
			)
		);

		if (!pluginUser) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 }
			);
		}

		const [metadata, pluginSessions] = await Promise.all([
			prisma.user.findUnique({
				where: { id },
				select: {
					stripeCustomerId: true,
					accounts: {
						select: {
							id: true,
							providerId: true,
							createdAt: true,
							updatedAt: true,
						},
					},
					_count: {
						select: {
							conversations: true,
							sharedConversations: true,
							fileObjects: true,
							usageEvents: true,
							moderationEvents: true,
							abuseSignals: true,
							messageAttachments: true,
							sessions: true,
						},
					},
				},
			}),
			betterAuthAdminApi().listUserSessions({
				body: { userId: id },
				headers: request.headers,
			}),
		]);

		const sessions = (pluginSessions.sessions ?? [])
			.map(toSafeAdminSession)
			.filter((session): session is NonNullable<typeof session> =>
				Boolean(session)
			);

		return NextResponse.json({
			user: {
				...pluginUser,
				stripeCustomerId: metadata?.stripeCustomerId ?? null,
				sessions,
				accounts: metadata?.accounts ?? [],
				_count: metadata?._count ?? {
					conversations: 0,
					sharedConversations: 0,
					fileObjects: 0,
					usageEvents: 0,
					moderationEvents: 0,
					abuseSignals: 0,
					messageAttachments: 0,
					sessions: sessions.length,
				},
			},
		});
	} catch (error) {
		logServerError("admin/users", "detail_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch user" },
			{ status: 500 }
		);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	try {
		const { id } = await params;
		const body = await request.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid body", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		if (id === admin.session.user.id) {
			return NextResponse.json(
				{ error: "Admins cannot modify their own admin state." },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "admin:user:update",
				actorKey: `admin:${admin.session.user.id}`,
				requestInput: { id, ...parsed.data },
			},
			async () => {
				const existing = await prisma.user.findUnique({
					where: { id },
					select: { id: true, role: true, banned: true },
				});
				if (!existing) {
					return { body: { error: "User not found" }, status: 404 };
				}

				if (parsed.data.role && parsed.data.role !== existing.role) {
					await betterAuthAdminApi().setRole({
						body: { userId: id, role: parsed.data.role },
						headers: request.headers,
					});
				}
				if (parsed.data.banned === true) {
					await betterAuthAdminApi().banUser({
						body: {
							userId: id,
							banReason: parsed.data.banReason ?? undefined,
							banExpiresIn: secondsUntil(parsed.data.banExpires),
						},
						headers: request.headers,
					});
				} else if (parsed.data.banned === false) {
					await betterAuthAdminApi().unbanUser({
						body: { userId: id },
						headers: request.headers,
					});
				}

				const updated = toSafeAdminUser(
					unwrapAdminUser(
						await betterAuthAdminApi().getUser({
							query: { id },
							headers: request.headers,
						})
					)
				);
				if (!updated) {
					return { body: { error: "User not found" }, status: 404 };
				}

				await recordAdminAuditEvent({
					actorId: admin.session.user.id,
					action: "user.update",
					targetType: "user",
					targetId: id,
					request,
					metadata: {
						previousRole: existing.role,
						nextRole: updated.role,
						previousBanned: existing.banned ?? false,
						nextBanned: updated.banned,
					},
				});

				return {
					body: { user: updated },
					resourceType: "user",
					resourceId: id,
				};
			}
		);
	} catch (error) {
		logServerError("admin/users", "update_failed", error);
		return NextResponse.json(
			{ error: "Failed to update user" },
			{ status: 500 }
		);
	}
}
