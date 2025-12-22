import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fork-ai.com'

	return {
		rules: [
			{
				userAgent: '*',
				allow: ['/', '/landing', '/prelaunch', '/login', '/signup', '/policy'],
				disallow: ['/admin/', '/api/'],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	}
}
