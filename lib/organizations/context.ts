import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import {
	normalizeOrganizationRole,
	organizationRoleHasPermission,
	type OrganizationRole,
} from "./roles";

type SessionLike = Awaited<ReturnType<typeof auth.api.getSession>>;

interface MemberDelegate {
	findFirst(_args: {
		where: { userId: string; organizationId: string };
		select: { role: true };
	}): Promise<{ role: string } | null>;
}

interface OrganizationAuditDelegate {
	create(_args: { data: Record<string, unknown> }): Promise<unknown>;
}

export interface WorkspaceContext {
	userId: string;
	organizationId: string | null;
	role: OrganizationRole | null;
	isPersonal: boolean;
}

export type WorkspaceAuthResult =
	| { ok: true; workspace: WorkspaceContext }
	| { ok: false; response: NextResponse };

function organizationMemberDelegate(prismaClient = prisma) {
	return (prismaClient as unknown as { member: MemberDelegate }).member;
}

function organizationAuditDelegate(prismaClient = prisma) {
	return (
		prismaClient as unknown as {
			organizationAuditLog: OrganizationAuditDelegate;
		}
	).organizationAuditLog;
}

export function getSessionActiveOrganizationId(session: SessionLike) {
	const sessionRecord = session?.session as
		| { activeOrganizationId?: string | null }
		| undefined;
	return sessionRecord?.activeOrganizationId?.trim() || null;
}

export function tenantDataScope(workspace: WorkspaceContext) {
	return {
		userId: workspace.userId,
		organizationId: workspace.organizationId,
	};
}

export function organizationDataScope(workspace: WorkspaceContext) {
	return { organizationId: workspace.organizationId };
}

export async function resolveWorkspaceContext({
	session,
	requiredPermission,
	prismaClient = prisma,
}: {
	session: SessionLike;
	requiredPermission?: Parameters<typeof organizationRoleHasPermission>[1];
	prismaClient?: typeof prisma;
}): Promise<WorkspaceAuthResult> {
	if (!session?.user?.id) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			),
		};
	}

	const organizationId = getSessionActiveOrganizationId(session);
	if (!organizationId) {
		return {
			ok: true,
			workspace: {
				userId: session.user.id,
				organizationId: null,
				role: null,
				isPersonal: true,
			},
		};
	}

	const membership = await organizationMemberDelegate(prismaClient).findFirst(
		{
			where: {
				userId: session.user.id,
				organizationId,
			},
			select: { role: true },
		}
	);

	if (!membership) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Organization access denied" },
				{ status: 403 }
			),
		};
	}

	const role = normalizeOrganizationRole(membership.role);
	if (
		requiredPermission &&
		!organizationRoleHasPermission(role, requiredPermission)
	) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Organization permission denied" },
				{ status: 403 }
			),
		};
	}

	return {
		ok: true,
		workspace: {
			userId: session.user.id,
			organizationId,
			role,
			isPersonal: false,
		},
	};
}

export async function recordOrganizationAuditLog(options: {
	workspace: WorkspaceContext;
	action: string;
	targetType: string;
	targetId?: string | null;
	request?: Request;
	metadata?: Record<string, unknown> | null;
	prismaClient?: typeof prisma;
}) {
	if (!options.workspace.organizationId) return;

	try {
		await organizationAuditDelegate(options.prismaClient).create({
			data: {
				organizationId: options.workspace.organizationId,
				actorId: options.workspace.userId,
				action: options.action,
				targetType: options.targetType,
				targetId: options.targetId ?? null,
				requestId:
					options.request?.headers.get("x-request-id")?.trim() ||
					options.request?.headers.get("x-vercel-id")?.trim() ||
					null,
				idempotencyKey:
					options.request?.headers.get("Idempotency-Key")?.trim() ||
					null,
				metadataJson: options.metadata
					? JSON.parse(JSON.stringify(options.metadata))
					: null,
			},
		});
	} catch (error) {
		logServerError("organization/audit", "record_failed", error, {
			action: options.action,
			targetType: options.targetType,
			organizationId: options.workspace.organizationId,
		});
	}
}
