import { auth } from "@/lib/auth";

export type BetterAuthAdminUser = {
	id: string;
	name?: string | null;
	email?: string | null;
	emailVerified?: boolean | null;
	role?: string | string[] | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: Date | string | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	image?: string | null;
	[key: string]: unknown;
};

export type SafeAdminUser = {
	id: string;
	name: string | null;
	email: string | null;
	emailVerified: boolean;
	role: string;
	banned: boolean;
	banReason: string | null;
	banExpires: Date | string | null;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
	image: string | null;
};

export type SafeAdminSession = {
	id: string;
	expiresAt: Date | string | null;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
	ipAddress: string | null;
	userAgent: string | null;
	impersonatedBy: string | null;
};

type AdminApi = {
	listUsers(_args: {
		query?: Record<string, unknown>;
		headers?: Headers;
	}): Promise<{ users?: BetterAuthAdminUser[]; total?: number }>;
	getUser(_args: {
		query: { id: string };
		headers?: Headers;
	}): Promise<BetterAuthAdminUser | { user?: BetterAuthAdminUser } | null>;
	createUser(_args: {
		body: {
			email: string;
			password: string;
			name: string;
			role?: string;
			data?: Record<string, unknown>;
		};
		headers?: Headers;
	}): Promise<{ user?: BetterAuthAdminUser } | BetterAuthAdminUser>;
	setRole(_args: {
		body: { userId: string; role: string };
		headers?: Headers;
	}): Promise<{ user?: BetterAuthAdminUser } | BetterAuthAdminUser>;
	banUser(_args: {
		body: { userId: string; banReason?: string; banExpiresIn?: number };
		headers?: Headers;
	}): Promise<{ user?: BetterAuthAdminUser } | BetterAuthAdminUser>;
	unbanUser(_args: {
		body: { userId: string };
		headers?: Headers;
	}): Promise<{ user?: BetterAuthAdminUser } | BetterAuthAdminUser>;
	setUserPassword(_args: {
		body: { userId: string; newPassword: string };
		headers?: Headers;
	}): Promise<unknown>;
	listUserSessions(_args: {
		body: { userId: string };
		headers?: Headers;
	}): Promise<{ sessions?: Array<Record<string, unknown>> }>;
	revokeUserSession(_args: {
		body: { sessionToken: string };
		headers?: Headers;
	}): Promise<{ success?: boolean }>;
	revokeUserSessions(_args: {
		body: { userId: string };
		headers?: Headers;
	}): Promise<{ success?: boolean }>;
	impersonateUser(_args: {
		body: { userId: string };
		headers?: Headers;
	}): Promise<{ user?: BetterAuthAdminUser; session?: unknown }>;
	stopImpersonating(_args: {
		headers?: Headers;
	}): Promise<{ user?: BetterAuthAdminUser; session?: unknown }>;
};

export function betterAuthAdminApi() {
	return auth.api as unknown as AdminApi;
}

export function normalizeRole(role: BetterAuthAdminUser["role"]) {
	if (Array.isArray(role)) return role.join(",");
	return role || "user";
}

export function unwrapAdminUser(
	value:
		| BetterAuthAdminUser
		| { user?: BetterAuthAdminUser }
		| null
		| undefined
): BetterAuthAdminUser | null {
	if (!value) return null;
	if ("user" in value) {
		return (value as { user?: BetterAuthAdminUser }).user ?? null;
	}
	return value as BetterAuthAdminUser;
}

export function toSafeAdminUser(
	user: BetterAuthAdminUser | null | undefined
): SafeAdminUser | null {
	if (!user?.id) return null;
	return {
		id: user.id,
		name: typeof user.name === "string" ? user.name : null,
		email: typeof user.email === "string" ? user.email : null,
		emailVerified: Boolean(user.emailVerified),
		role: normalizeRole(user.role),
		banned: Boolean(user.banned),
		banReason: typeof user.banReason === "string" ? user.banReason : null,
		banExpires: user.banExpires ?? null,
		createdAt: user.createdAt ?? null,
		updatedAt: user.updatedAt ?? null,
		image: typeof user.image === "string" ? user.image : null,
	};
}

export function toSafeAdminSession(
	session: Record<string, unknown>
): SafeAdminSession | null {
	const id = typeof session.id === "string" ? session.id : null;
	if (!id) return null;

	return {
		id,
		expiresAt:
			session.expiresAt instanceof Date ||
			typeof session.expiresAt === "string"
				? session.expiresAt
				: null,
		createdAt:
			session.createdAt instanceof Date ||
			typeof session.createdAt === "string"
				? session.createdAt
				: null,
		updatedAt:
			session.updatedAt instanceof Date ||
			typeof session.updatedAt === "string"
				? session.updatedAt
				: null,
		ipAddress:
			typeof session.ipAddress === "string" ? session.ipAddress : null,
		userAgent:
			typeof session.userAgent === "string" ? session.userAgent : null,
		impersonatedBy:
			typeof session.impersonatedBy === "string"
				? session.impersonatedBy
				: null,
	};
}

export function secondsUntil(dateIso: string | null | undefined) {
	if (!dateIso) return undefined;
	const expiresAt = new Date(dateIso).getTime();
	if (!Number.isFinite(expiresAt)) return undefined;
	const seconds = Math.ceil((expiresAt - Date.now()) / 1000);
	return seconds > 0 ? seconds : undefined;
}
