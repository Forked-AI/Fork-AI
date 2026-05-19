/**
 * Simple admin authentication utility
 * Uses ADMIN_PASSWORD environment variable
 */
import { logServerWarning } from "@/lib/server-safe-log";

export function verifyAdminPassword(password: string): boolean {
	const adminPassword = process.env.ADMIN_PASSWORD;

	if (!adminPassword) {
		logServerWarning("admin-auth", "missing_admin_password");
		return false;
	}

	return password === adminPassword;
}

export function getAdminPasswordFromHeader(request: Request): string | null {
	return request.headers.get("x-admin-password");
}

export function isAdminAuthenticated(request: Request): boolean {
	const password = getAdminPasswordFromHeader(request);
	if (!password) return false;
	return verifyAdminPassword(password);
}
