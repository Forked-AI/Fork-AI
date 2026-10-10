'use client'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useState } from 'react'

export function DesktopAuthorization({
	email,
	query,
}: {
	email: string
	query: Record<string, string>
}) {
	const [status, setStatus] = useState('')
	const [busy, setBusy] = useState(false)
	async function authorize() {
		setBusy(true)
		setStatus('')
		try {
			const result = await authClient.electron.transferUser({
				fetchOptions: { query },
			})
			if (result.error) throw new Error(result.error.message)
			authClient.ensureElectronRedirect()
			// The global DesktopAuthReturn component consumes the short-lived
			// authorization cookie and opens the app's registered protocol.
			setStatus(
				'Opening ForkAI Desktop. You can close this tab once the app opens.'
			)
		} catch {
			setStatus(
				'Could not open the desktop app. Start sign-in again from ForkAI Desktop.'
			)
		} finally {
			setBusy(false)
		}
	}
	return (
		<div className="mt-6 space-y-4">
			<p className="text-muted-foreground">
				Continue as {email} in ForkAI Desktop.
			</p>
			<Button disabled={busy} onClick={authorize}>
				{busy ? 'Opening…' : 'Continue to ForkAI Desktop'}
			</Button>
			<p role="status">{status}</p>
		</div>
	)
}
