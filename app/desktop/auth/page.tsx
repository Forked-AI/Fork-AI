import { DesktopAuthorization } from '@/components/desktop-authorization'
import { auth } from '@/lib/auth'
import { DESKTOP_CLIENT_ID } from '@/lib/desktop-config'
import { headers } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = {
	title: 'Sign in to ForkAI Desktop',
	robots: { index: false, follow: false },
}

export default async function DesktopAuthPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const params = await searchParams
	const clientID = params.client_id
	const state = params.state
	const challenge = params.code_challenge
	const valid =
		clientID === DESKTOP_CLIENT_ID &&
		typeof state === 'string' &&
		/^[A-Za-z0-9]{16}$/.test(state) &&
		typeof challenge === 'string' &&
		/^[A-Za-z0-9_-]{43}=?$/.test(challenge) &&
		params.code_challenge_method === 'S256'

	if (!valid) {
		return (
			<section className="mx-auto max-w-lg px-6 py-24">
				<h1 className="text-2xl font-semibold">
					Open ForkAI Desktop to sign in
				</h1>
				<p className="mt-4 text-muted-foreground">
					Start sign-in from the desktop app, then return to this browser
					window.
				</p>
			</section>
		)
	}

	const query = {
		client_id: clientID,
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256',
	}
	const session = await auth.api.getSession({ headers: await headers() })
	const next = `/desktop/auth?${new URLSearchParams(query)}`
	return (
		<section className="mx-auto max-w-lg px-6 py-24">
			<h1 className="text-3xl font-semibold">Sign in to ForkAI Desktop</h1>
			{session ? (
				<DesktopAuthorization email={session.user.email} query={query} />
			) : (
				<div className="mt-6 space-y-4">
					<p className="text-muted-foreground">
						Sign in with your ForkAI account to continue in the desktop app.
					</p>
					<Link
						className="inline-block underline"
						href={`/login?next=${encodeURIComponent(next)}`}
					>
						Sign in
					</Link>
					<p>
						<Link
							className="underline"
							href={`/signup?next=${encodeURIComponent(next)}`}
						>
							Create an account
						</Link>
					</p>
				</div>
			)}
		</section>
	)
}
