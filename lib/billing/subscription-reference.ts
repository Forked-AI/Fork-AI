import { prisma } from "@/lib/prisma";
import { organizationRoleHasPermission } from "@/lib/organizations/roles";

type SubscriptionReferenceAction =
	| "list-subscription"
	| "upgrade-subscription"
	| "cancel-subscription"
	| "restore-subscription"
	| "billing-portal"
	| string;
type SubscriptionCustomerType = "user" | "organization" | string;

interface SubscriptionReferenceSession {
	activeOrganizationId?: string | null;
	[key: string]: unknown;
}

interface SubscriptionReferenceUser {
	id: string;
}

interface MemberDelegate {
	findFirst(_args: {
		where: { userId: string; organizationId: string };
		select: { role: true };
	}): Promise<{ role: string } | null>;
}

interface SubscriptionReferencePrisma {
	member: MemberDelegate;
}

function memberDelegate(prismaClient = prisma) {
	return (prismaClient as unknown as SubscriptionReferencePrisma).member;
}

export function subscriptionActionPermission(
	action: SubscriptionReferenceAction
) {
	return action === "list-subscription" ? "billing:read" : "billing:write";
}

export async function authorizeSubscriptionReference({
	user,
	session,
	referenceId,
	customerType,
	action,
	prismaClient = prisma,
}: {
	user: SubscriptionReferenceUser;
	session?: SubscriptionReferenceSession | null;
	referenceId?: string | null;
	customerType?: SubscriptionCustomerType | null;
	action: SubscriptionReferenceAction;
	prismaClient?: typeof prisma;
}) {
	const normalizedReferenceId = referenceId?.trim() || user.id;
	const normalizedCustomerType = customerType ?? "user";

	if (normalizedCustomerType !== "organization") {
		return normalizedReferenceId === user.id;
	}

	const activeOrganizationId = session?.activeOrganizationId?.trim() || null;
	if (activeOrganizationId !== normalizedReferenceId) {
		return false;
	}

	const membership = await memberDelegate(prismaClient).findFirst({
		where: {
			userId: user.id,
			organizationId: normalizedReferenceId,
		},
		select: { role: true },
	});

	if (!membership) {
		return false;
	}

	return organizationRoleHasPermission(
		membership.role,
		subscriptionActionPermission(action)
	);
}
