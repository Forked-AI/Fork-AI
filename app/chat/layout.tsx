'use client'

import { Toaster } from '@/components/ui/toaster'
import { useEffect } from 'react'

export default function ChatLayoutWrapper({
	children,
}: {
	children: React.ReactNode
}) {
	// Global keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Cmd/Ctrl + / to open settings
			if (event.key === '/' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				window.dispatchEvent(new CustomEvent('openSettings'))
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	return (
		<>
			{children}
			<Toaster />
		</>
	)
}
