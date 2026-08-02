/** @type {import('next').NextConfig} */
const nextConfig = {
	distDir: process.env.NEXT_DIST_DIR || '.next',
	experimental: {
		webpackBuildWorker: process.env.NEXT_WEBPACK_BUILD_WORKER !== 'false',
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	images: {
		formats: ['image/avif', 'image/webp'],
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'images.unsplash.com',
			},
		],
	},
	async redirects() {
		return [
			{
				source: '/landing',
				destination: '/',
				permanent: true,
			},
		];
	},
	async headers() {
		const analyticsId = process.env.NEXT_PUBLIC_GA_ID?.trim();
		const scriptSources = ["'self'", "'unsafe-inline'"];
		if (process.env.NODE_ENV !== 'production') {
			scriptSources.push("'unsafe-eval'");
			scriptSources.push('https://unpkg.com');
		}
		if (analyticsId) {
			scriptSources.push('https://www.googletagmanager.com');
		}

		const contentSecurityPolicy = [
			"default-src 'self'",
			"base-uri 'self'",
			"frame-ancestors 'none'",
			"object-src 'none'",
			"form-action 'self'",
			`script-src ${scriptSources.join(' ')}`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' https: data: blob:",
			"font-src 'self' data:",
			"connect-src 'self' https:",
			"media-src 'self' https: blob:",
			'frame-src https://www.youtube.com https://youtube.com',
			'upgrade-insecure-requests',
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
			{
				source: '/admin/:path*',
				headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
			},
			{
				source: '/chat/:path*',
				headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
			},
			{
				source: '/share/:path*',
				headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
			},
		];
	},
};

export default nextConfig;
