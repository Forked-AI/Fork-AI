const origin = new URL(process.argv[2] || 'https://forkai.tech').origin;
try {
	const options = { redirect: 'error', signal: AbortSignal.timeout(15000) };
	const response = await fetch(`${origin}/api/desktop/auth-config`, options);
	const config = await response.json();
	if (
		!response.ok ||
		config.version !== 1 ||
		config.clientID !== 'forkai-desktop' ||
		config.protocol !== 'tech.forkai.desktop' ||
		config.callbackPath !== '/auth/callback'
	) {
		throw new Error('Compatible desktop sign-in configuration is missing');
	}
	const page = await fetch(`${origin}/desktop/auth`, {
		...options,
		signal: AbortSignal.timeout(15000),
	});
	if (
		!page.ok ||
		!(await page.text()).includes('Open ForkAI Desktop to sign in')
	) {
		throw new Error('Desktop browser authorization page is missing');
	}
	// Missing PKCE input must reach the plugin and fail validation, without starting OAuth.
	const endpoint = await fetch(`${origin}/api/auth/electron/init-oauth-proxy`, {
		...options,
		signal: AbortSignal.timeout(15000),
	});
	if (endpoint.status !== 400)
		throw new Error('Desktop OAuth endpoint is missing or unavailable');
	console.log(`Desktop sign-in support verified on ${origin}`);
} catch (error) {
	console.error(`Desktop sign-in deployment check failed: ${error.message}`);
	process.exitCode = 1;
}
