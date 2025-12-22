import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = (
		process.env.NEXT_PUBLIC_BASE_URL || "https://forkai.tech"
	).trim();

	return {
		rules: [
			{
				userAgent: "*",
				allow: [
					"/",
					"/landing",
					"/prelaunch",
					"/login",
					"/signup",
					"/policy",
				],
				disallow: ["/admin/", "/api/"],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
