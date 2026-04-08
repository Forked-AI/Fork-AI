'use client'

import { ChatUIProvider } from '@/components/chat/chat-ui-provider'
import { Toaster } from '@/components/ui/toaster'

export default function ChatLayoutWrapper({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<ChatUIProvider>
			{children}
			<Toaster />
		</ChatUIProvider>
	)
}
