import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: absoluteSiteUrl("/"),
		},
		{
			url: absoluteSiteUrl("/branching-ai-chat"),
		},
		{
			url: absoluteSiteUrl("/policy"),
		},
	];
}
