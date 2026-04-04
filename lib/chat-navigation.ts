export function openConversation(conversationId: string) {
	window.history.replaceState({}, '', `/chat?c=${conversationId}`)
	window.dispatchEvent(
		new CustomEvent('chatChanged', {
			detail: { conversationId },
		})
	)
}

export function openNewChat() {
	window.history.replaceState({}, '', '/chat')
	window.dispatchEvent(
		new CustomEvent('chatChanged', {
			detail: { newChat: true },
		})
	)
}
