export const ORGANIZATION_ROLES = [
	"owner",
	"admin",
	"member",
	"billing_admin",
	"viewer",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

type OrganizationPermission =
	| "organization:read"
	| "organization:update"
	| "organization:delete"
	| "member:read"
	| "member:write"
	| "billing:read"
	| "billing:write"
	| "workspace:read"
	| "workspace:write"
	| "audit:read";

const ROLE_PERMISSIONS: Record<
	OrganizationRole,
	Set<OrganizationPermission>
> = {
	owner: new Set([
		"organization:read",
		"organization:update",
		"organization:delete",
		"member:read",
		"member:write",
		"billing:read",
		"billing:write",
		"workspace:read",
		"workspace:write",
		"audit:read",
	]),
	admin: new Set([
		"organization:read",
		"organization:update",
		"member:read",
		"member:write",
		"billing:read",
		"workspace:read",
		"workspace:write",
		"audit:read",
	]),
	member: new Set(["organization:read", "workspace:read", "workspace:write"]),
	billing_admin: new Set([
		"organization:read",
		"member:read",
		"billing:read",
		"billing:write",
		"workspace:read",
	]),
	viewer: new Set(["organization:read", "workspace:read"]),
};

export function normalizeOrganizationRole(role: string): OrganizationRole {
	return ORGANIZATION_ROLES.includes(role as OrganizationRole)
		? (role as OrganizationRole)
		: "member";
}

export function organizationRoleHasPermission(
	role: string,
	permission: OrganizationPermission
) {
	return ROLE_PERMISSIONS[normalizeOrganizationRole(role)].has(permission);
}
