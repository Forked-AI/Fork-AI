import { ChatSharesPage } from '@/components/chat/chat-shares-page'
import { ChatShell } from '@/components/chat/chat-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Shared Links | Fork.AI',
	description: 'Manage active shared conversation links, view their status, and revoke access.',
}

export default function ChatSharesRoute() {
	return (
		<ChatShell>
			<ChatSharesPage />
		</ChatShell>
	)
}
