const FALLBACK_SITE_URL = "https://forkai.tech";

function normalizeSiteUrl(value: string | undefined): string {
	const candidate = value?.trim() || FALLBACK_SITE_URL;

	try {
		const url = new URL(candidate);
		url.hash = "";
		url.search = "";
		url.pathname = "/";
		return url.toString().replace(/\/$/, "");
	} catch {
		return FALLBACK_SITE_URL;
	}
}

export const SITE_NAME = "ForkAI";
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_BASE_URL);

export function absoluteSiteUrl(path = "/"): string {
	return new URL(path, `${SITE_URL}/`).toString();
}
