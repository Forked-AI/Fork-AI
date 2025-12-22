'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
	GitBranch,
	LayoutDashboard,
	Loader2,
	Lock,
	LogOut,
	Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'

const navItems = [
	{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
	{ href: '/admin/waitlist', label: 'Waitlist', icon: Users },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const pathname = usePathname()

	useEffect(() => {
		// Check if already authenticated
		const storedPassword = sessionStorage.getItem('adminPassword')
		if (storedPassword) {
			setIsAuthenticated(true)
		}
		setIsLoading(false)
	}, [])

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setIsLoading(true)

		try {
			// Test the password by making a request to the stats endpoint
			const response = await fetch('/api/admin/stats', {
				headers: { 'x-admin-password': password },
			})

			if (response.ok) {
				sessionStorage.setItem('adminPassword', password)
				setIsAuthenticated(true)
			} else {
				setError('Invalid password')
			}
		} catch {
			setError('Something went wrong')
		} finally {
			setIsLoading(false)
		}
	}

	const handleLogout = () => {
		sessionStorage.removeItem('adminPassword')
		setIsAuthenticated(false)
		setPassword('')
	}

	if (isLoading) {
		return (
			<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-white/60" />
			</div>
		)
	}

	if (!isAuthenticated) {
		return (
			<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
				<div className="w-full max-w-md">
					<div className="bg-[#111] border border-white/10 rounded-2xl p-8">
						<div className="flex items-center justify-center gap-2 mb-8">
							<Lock className="w-8 h-8 text-indigo-400" />
							<h1 className="text-2xl font-bold text-white">Admin Access</h1>
						</div>

						<form onSubmit={handleLogin} className="space-y-4">
							<div>
								<Input
									type="password"
									placeholder="Enter admin password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="bg-[#1a1a1a] border-white/10 text-white placeholder:text-white/40"
								/>
							</div>
							{error && (
								<p className="text-red-400 text-sm text-center">{error}</p>
							)}
							<Button
								type="submit"
								disabled={isLoading || !password}
								className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
							>
								{isLoading ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									'Login'
								)}
							</Button>
						</form>

						<p className="text-white/40 text-sm text-center mt-6">
							Fork.AI Admin Dashboard
						</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-[#0a0a0a] flex">
			{/* Sidebar */}
			<aside className="w-64 bg-[#111] border-r border-white/10 flex flex-col">
				<div className="p-6 border-b border-white/10">
					<Link href="/admin" className="flex items-center gap-2">
						<GitBranch className="w-6 h-6 text-white" />
						<span className="text-xl font-bold text-white">Fork.AI</span>
					</Link>
					<p className="text-white/40 text-sm mt-1">Admin Dashboard</p>
				</div>

				<nav className="flex-1 p-4 space-y-1">
					{navItems.map((item) => {
						const isActive = pathname === item.href
						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
									isActive
										? 'bg-indigo-600/20 text-indigo-400'
										: 'text-white/60 hover:text-white hover:bg-white/5'
								)}
							>
								<item.icon className="w-5 h-5" />
								{item.label}
							</Link>
						)
					})}
				</nav>

				<div className="p-4 border-t border-white/10">
					<button
						onClick={handleLogout}
						className="flex items-center gap-3 px-4 py-3 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors w-full"
					>
						<LogOut className="w-5 h-5" />
						Logout
					</button>
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	)
}
