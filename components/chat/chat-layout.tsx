'use client'

import { ChatArea } from './chat-area'
import { ChatShell } from './chat-shell'

export function ChatLayout() {
	return (
		<ChatShell>
			<ChatArea />
		</ChatShell>
	)
}
