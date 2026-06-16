'use client'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import { cn } from '@/lib/utils'
import {
	Activity,
	BarChart3,
	ClipboardList,
	GitBranch,
	LayoutDashboard,
	ListChecks,
	Loader2,
	LogOut,
	Menu,
	ShieldAlert,
	Users,
	Wrench,
	X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'

const navItems = [
	{ href: '/admin', label: 'Overview', icon: LayoutDashboard },
	{ href: '/admin/users', label: 'Users', icon: Users },
	{ href: '/admin/usage', label: 'AI Usage', icon: BarChart3 },
	{ href: '/admin/monitoring', label: 'Monitoring', icon: Activity },
	{ href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
	{ href: '/admin/tools', label: 'Tools', icon: Wrench },
	{ href: '/admin/waitlist', label: 'Waitlist', icon: ListChecks },
	{ href: '/admin/audit', label: 'Audit', icon: ClipboardList },
]

type AdminUser = {
	id: string
	email?: string | null
	name?: string | null
	role?: string | null
}

type AdminSession = {
	impersonatedBy?: string | null
}

export default function AdminLayout({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AdminUser | null>(null)
	const [session, setSession] = useState<AdminSession | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	const pathname = usePathname()

	useEffect(() => {
		let isMounted = true
		void authClient.getSession().then(({ data }) => {
			if (!isMounted) return
			setUser((data?.user as AdminUser | undefined) ?? null)
			setSession((data?.session as AdminSession | undefined) ?? null)
			setIsLoading(false)
		})
		return () => {
			isMounted = false
		}
	}, [])

	useEffect(() => setIsMobileOpen(false), [pathname])

	const handleLogout = async () => {
		await authClient.signOut()
		window.location.href = '/login'
	}

	const stopImpersonating = async () => {
		await fetch('/api/admin/users/stop-impersonating', {
			method: 'POST',
			headers: createIdempotencyHeaders('admin-stop-impersonating'),
		})
		window.location.href = '/admin/users'
	}

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
				<Loader2 className="h-8 w-8 animate-spin text-white/60" />
			</div>
		)
	}

	if (session?.impersonatedBy) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-6 text-white">
				<div className="max-w-md rounded-xl border border-amber-400/20 bg-[#111] p-8 text-center">
					<ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-200" />
					<h1 className="text-2xl font-semibold">Impersonating user</h1>
					<p className="mt-2 text-sm text-white/60">
						Stop impersonating to return to the admin console.
					</p>
					<Button
						onClick={stopImpersonating}
						className="mt-6 bg-amber-500 text-black hover:bg-amber-400"
					>
						Stop impersonating
					</Button>
				</div>
			</div>
		)
	}

	if (!user || user.role !== 'admin') {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-6 text-white">
				<div className="max-w-md rounded-xl border border-white/10 bg-[#111] p-8 text-center">
					<ShieldAlert className="mx-auto mb-4 h-10 w-10 text-red-300" />
					<h1 className="text-2xl font-semibold">Admin access required</h1>
					<p className="mt-2 text-sm text-white/60">
						Sign in with an account that has the admin role.
					</p>
					<Button asChild className="mt-6 bg-indigo-600 hover:bg-indigo-500">
						<Link href="/login">Go to login</Link>
					</Button>
				</div>
			</div>
		)
	}

	const sidebar = (
		<aside className="flex h-full w-72 flex-col border-r border-white/10 bg-[#111]">
			<div className="border-b border-white/10 p-5">
				<Link href="/admin" className="flex items-center gap-2">
					<GitBranch className="h-6 w-6 text-white" />
					<span className="text-xl font-bold text-white">Fork.AI</span>
				</Link>
				<p className="mt-1 text-sm text-white/40">Operations Console</p>
			</div>

			<nav className="flex-1 space-y-1 p-4">
				{navItems.map((item) => {
					const isActive =
						pathname === item.href ||
						(item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								'flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
								isActive
									? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/20'
									: 'text-white/60 hover:bg-white/5 hover:text-white'
							)}
						>
							<item.icon className="h-5 w-5" />
							{item.label}
						</Link>
					)
				})}
			</nav>

			<div className="border-t border-white/10 p-4">
				<div className="mb-3 truncate px-4 text-xs text-white/50">
					{user.email ?? user.name ?? user.id}
				</div>
				<button
					onClick={handleLogout}
					className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
				>
					<LogOut className="h-5 w-5" />
					Logout
				</button>
			</div>
		</aside>
	)

	return (
		<div className="min-h-screen bg-[#0a0a0a] text-white">
			<div className="flex min-h-screen">
				<div className="hidden lg:block">{sidebar}</div>
				{isMobileOpen ? (
					<div className="fixed inset-0 z-50 flex lg:hidden">
						<div className="absolute inset-0 bg-black/60" />
						<div className="relative h-full">{sidebar}</div>
						<button
							type="button"
							aria-label="Close admin navigation"
							onClick={() => setIsMobileOpen(false)}
							className="absolute right-4 top-4 rounded-lg border border-white/10 bg-[#111] p-2 text-white"
						>
							<X className="h-5 w-5" />
						</button>
					</div>
				) : null}
				<main className="min-w-0 flex-1">
					<header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#0a0a0a]/90 px-4 backdrop-blur lg:hidden">
						<Link
							href="/admin"
							className="flex items-center gap-2 font-semibold"
						>
							<GitBranch className="h-5 w-5" />
							Fork.AI Admin
						</Link>
						<button
							type="button"
							aria-label="Open admin navigation"
							onClick={() => setIsMobileOpen(true)}
							className="rounded-lg border border-white/10 p-2 text-white"
						>
							<Menu className="h-5 w-5" />
						</button>
					</header>
					{children}
				</main>
			</div>
		</div>
	)
}
