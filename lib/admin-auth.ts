/**
 * Simple admin authentication utility
 * Uses ADMIN_PASSWORD environment variable
 */

export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.warn("ADMIN_PASSWORD not set in environment variables");
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
