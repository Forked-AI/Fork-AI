'use client'

import { authClient } from '@/lib/auth-client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// OAuth may return to the homepage, login, or chat. Complete the browser-to-app
// handoff on every route without exposing session cookies to page JavaScript.
export function DesktopAuthReturn() {
	const pathname = usePathname()
	useEffect(() => {
		const timer = authClient.ensureElectronRedirect()
		return () => clearInterval(timer)
	}, [pathname])
	return null
}
