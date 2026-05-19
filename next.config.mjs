/** @type {import('next').NextConfig} */
const nextConfig = {
	eslint: {
		ignoreDuringBuilds: true,
	},
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**',
			},
		],
	},
	async headers() {
		const contentSecurityPolicy = [
			"default-src 'self'",
			"base-uri 'self'",
			"frame-ancestors 'none'",
			"object-src 'none'",
			"form-action 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' https: data: blob:",
			"font-src 'self' data:",
			"connect-src 'self' https:",
			"media-src 'self' https: blob:",
			"frame-src https://www.youtube.com https://youtube.com",
			"upgrade-insecure-requests",
		].join('; ');

		return [
			{
				source: '/(.*)',
				headers: [
					{
						key: 'Content-Security-Policy',
						value: contentSecurityPolicy,
					},
					{
						key: 'X-Frame-Options',
						value: 'DENY',
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin',
					},
					{
						key: 'Permissions-Policy',
						value:
							'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
					},
					{
						key: 'Strict-Transport-Security',
						value: 'max-age=63072000; includeSubDomains; preload',
					},
				],
			},
		];
	},
};

export default nextConfig;
