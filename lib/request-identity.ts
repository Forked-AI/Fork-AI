import { createHash } from "node:crypto";

function getHeaderValue(headers: Headers, name: string): string | null {
	return headers.get(name) ?? headers.get(name.toLowerCase());
}

function getClientIp(headers: Headers): string {
	const forwardedFor = getHeaderValue(headers, "x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",")[0]?.trim() || "unknown-ip";
	}

	return (
		getHeaderValue(headers, "cf-connecting-ip") ??
		getHeaderValue(headers, "x-real-ip") ??
		"unknown-ip"
	);
}

export function hashIdentity(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function getRequestFingerprint(request: Request): string {
	const ip = getClientIp(request.headers);
	const userAgent =
		getHeaderValue(request.headers, "user-agent") ?? "unknown-user-agent";

	return hashIdentity(`${ip}|${userAgent}`);
}

export function getRequestIdentity(
	request: Request,
	...parts: Array<string | number | null | undefined>
): string {
	const fingerprint = getRequestFingerprint(request);
	const normalizedParts = parts
		.filter((part) => part !== null && part !== undefined && part !== "")
		.map((part) => String(part));

	return hashIdentity([fingerprint, ...normalizedParts].join("|"));
}
