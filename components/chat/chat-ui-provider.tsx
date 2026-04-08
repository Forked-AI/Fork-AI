'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'

interface ChatUIContextValue {
	settingsOpen: boolean
	setSettingsOpen: (open: boolean) => void
	openSettings: () => void
	closeSettings: () => void
	generatingTitleIds: Set<string>
	startTitleGeneration: (conversationId: string) => void
	finishTitleGeneration: (conversationId: string) => void
}

const ChatUIContext = createContext<ChatUIContextValue | null>(null)

export function ChatUIProvider({ children }: { children: ReactNode }) {
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [generatingTitleIds, setGeneratingTitleIds] = useState<Set<string>>(
		new Set()
	)

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === '/' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				setSettingsOpen(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	const startTitleGeneration = useCallback((conversationId: string) => {
		setGeneratingTitleIds((current) => {
			const next = new Set(current)
			next.add(conversationId)
			return next
		})
	}, [])

	const finishTitleGeneration = useCallback((conversationId: string) => {
		setGeneratingTitleIds((current) => {
			if (!current.has(conversationId)) return current
			const next = new Set(current)
			next.delete(conversationId)
			return next
		})
	}, [])

	const value = useMemo<ChatUIContextValue>(
		() => ({
			settingsOpen,
			setSettingsOpen,
			openSettings: () => setSettingsOpen(true),
			closeSettings: () => setSettingsOpen(false),
			generatingTitleIds,
			startTitleGeneration,
			finishTitleGeneration,
		}),
		[finishTitleGeneration, generatingTitleIds, settingsOpen, startTitleGeneration]
	)

	return <ChatUIContext.Provider value={value}>{children}</ChatUIContext.Provider>
}

export function useChatUI() {
	const context = useContext(ChatUIContext)

	if (!context) {
		throw new Error('useChatUI must be used within a ChatUIProvider.')
	}

	return context
}
