'use client'

import { authClient } from '@/lib/auth-client'
import type { Session, User } from 'better-auth/types'
import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from 'react'

interface AuthContextType {
	user: User | null
	session: Session | null
	isLoading: boolean
	isAuthenticated: boolean
	logout: () => Promise<void>
	refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [session, setSession] = useState<Session | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	const refreshSession = async () => {
		try {
			const { data } = await authClient.getSession()
			if (data) {
				setUser(data.user)
				setSession(data.session)
			} else {
				setUser(null)
				setSession(null)
			}
		} catch (error) {
			console.error('Failed to refresh session:', error)
			setUser(null)
			setSession(null)
		}
	}

	const logout = async () => {
		try {
			// Sign out the user
			await authClient.signOut()

			// Clear local state
			setUser(null)
			setSession(null)

			// Clear any local storage data that might persist
			if (typeof window !== 'undefined') {
				// Clear conversation-related data
				localStorage.removeItem('conversations')
				localStorage.removeItem('currentConversation')
				localStorage.removeItem('chatSettings')

				// Clear any session storage
				sessionStorage.clear()
			}

			// Force redirect and page refresh to ensure all state is cleared
			window.location.href = '/'
		} catch (error) {
			console.error('Logout failed:', error)

			// Even if logout fails, clear local state and redirect
			setUser(null)
			setSession(null)
			window.location.href = '/'
		}
	}

	// Load session on mount
	useEffect(() => {
		const loadSession = async () => {
			setIsLoading(true)
			await refreshSession()
			setIsLoading(false)
		}

		loadSession()
	}, [])

	const value: AuthContextType = {
		user,
		session,
		isLoading,
		isAuthenticated: !!user,
		logout,
		refreshSession,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
	const context = useContext(AuthContext)
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}
