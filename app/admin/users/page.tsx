'use client'

import { Button } from '@/components/ui/button'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import {
	Ban,
	Eye,
	KeyRound,
	Loader2,
	Plus,
	RefreshCw,
	Search,
	Shield,
	UserCog,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface AdminUser {
	id: string
	name: string | null
	email: string | null
	emailVerified: boolean
	role: string
	banned: boolean
	banReason: string | null
	banExpires: string | null
	createdAt: string | null
	updatedAt: string | null
	stripeCustomerId: string | null
	_count: Record<string, number>
	currentMonthUsage?: { usedTokens: number; usedUsd: string }
	sessions?: Array<{
		id: string
		expiresAt: string | null
		createdAt: string | null
		updatedAt: string | null
		ipAddress: string | null
		userAgent: string | null
		impersonatedBy: string | null
	}>
	accounts?: Array<{ id: string; providerId: string; createdAt: string }>
}

interface UsersPayload {
	users: AdminUser[]
	pagination: { page: number; limit: number; total: number; totalPages: number }
}

function fmt(value: number) {
	return value.toLocaleString()
}

async function readError(response: Response, fallback: string) {
	const body = await response.json().catch(() => ({}))
	return typeof body.error === 'string' ? body.error : fallback
}

export default function AdminUsersPage() {
	const [payload, setPayload] = useState<UsersPayload | null>(null)
	const [search, setSearch] = useState('')
	const [role, setRole] = useState('')
	const [banned, setBanned] = useState('')
	const [page, setPage] = useState(1)
	const [selected, setSelected] = useState<AdminUser | null>(null)
	const [detailLoading, setDetailLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [createOpen, setCreateOpen] = useState(false)
	const [createEmail, setCreateEmail] = useState('')
	const [createName, setCreateName] = useState('')
	const [createPassword, setCreatePassword] = useState('')
	const [createRole, setCreateRole] = useState('user')
	const [newPassword, setNewPassword] = useState('')
	const [editRole, setEditRole] = useState('user')
	const [editBanned, setEditBanned] = useState(false)
	const [banReason, setBanReason] = useState('')
	const [banExpires, setBanExpires] = useState('')

	async function loadUsers(nextPage = page) {
		setLoading(true)
		setError('')
		try {
			const params = new URLSearchParams({
				page: String(nextPage),
				limit: '25',
			})
			if (search.trim()) params.set('search', search.trim())
			if (role) params.set('role', role)
			if (banned) params.set('banned', banned)
			const response = await fetch(`/api/admin/users?${params.toString()}`)
			if (!response.ok)
				throw new Error(await readError(response, 'Failed to load users'))
			setPayload((await response.json()) as UsersPayload)
			setPage(nextPage)
		} catch (loadError) {
			setError(
				loadError instanceof Error ? loadError.message : 'Failed to load users'
			)
		} finally {
			setLoading(false)
		}
	}

	async function loadDetail(userId: string) {
		setDetailLoading(true)
		setError('')
		try {
			const response = await fetch(`/api/admin/users/${userId}`)
			if (!response.ok) {
				throw new Error(await readError(response, 'Failed to load user detail'))
			}
			const data = (await response.json()) as { user: AdminUser }
			setSelected(data.user)
			setEditRole(data.user.role)
			setEditBanned(data.user.banned)
			setBanReason(data.user.banReason ?? '')
			setBanExpires(
				data.user.banExpires ? data.user.banExpires.slice(0, 10) : ''
			)
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Failed to load user detail'
			)
		} finally {
			setDetailLoading(false)
		}
	}

	async function createUser() {
		setSaving(true)
		setError('')
		try {
			const response = await fetch('/api/admin/users', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('admin-user-create'),
				},
				body: JSON.stringify({
					email: createEmail,
					name: createName,
					password: createPassword,
					role: createRole,
				}),
			})
			if (!response.ok)
				throw new Error(await readError(response, 'Failed to create user'))
			setCreateOpen(false)
			setCreateEmail('')
			setCreateName('')
			setCreatePassword('')
			setCreateRole('user')
			await loadUsers(1)
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: 'Failed to create user'
			)
		} finally {
			setSaving(false)
		}
	}

	async function saveUser() {
		if (!selected) return
		setSaving(true)
		setError('')
		try {
			const response = await fetch(`/api/admin/users/${selected.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('admin-user-update'),
				},
				body: JSON.stringify({
					role: editRole,
					banned: editBanned,
					banReason: editBanned ? banReason || null : null,
					banExpires:
						editBanned && banExpires
							? new Date(`${banExpires}T00:00:00.000Z`).toISOString()
							: null,
				}),
			})
			if (!response.ok)
				throw new Error(await readError(response, 'Failed to update user'))
			await loadDetail(selected.id)
			await loadUsers(page)
		} catch (saveError) {
			setError(
				saveError instanceof Error ? saveError.message : 'Failed to update user'
			)
		} finally {
			setSaving(false)
		}
	}

	async function setPassword() {
		if (!selected || !newPassword) return
		setSaving(true)
		setError('')
		try {
			const response = await fetch(`/api/admin/users/${selected.id}/password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('admin-user-set-password'),
				},
				body: JSON.stringify({ newPassword }),
			})
			if (!response.ok) {
				throw new Error(await readError(response, 'Failed to set password'))
			}
			setNewPassword('')
		} catch (passwordError) {
			setError(
				passwordError instanceof Error
					? passwordError.message
					: 'Failed to set password'
			)
		} finally {
			setSaving(false)
		}
	}

	async function revokeSession(sessionId: string) {
		if (!selected) return
		setSaving(true)
		setError('')
		try {
			const response = await fetch(
				`/api/admin/users/${selected.id}/sessions/${sessionId}/revoke`,
				{
					method: 'POST',
					headers: createIdempotencyHeaders('admin-user-revoke-session'),
				}
			)
			if (!response.ok) {
				throw new Error(await readError(response, 'Failed to revoke session'))
			}
			await loadDetail(selected.id)
		} catch (sessionError) {
			setError(
				sessionError instanceof Error
					? sessionError.message
					: 'Failed to revoke session'
			)
		} finally {
			setSaving(false)
		}
	}

	async function revokeAllSessions() {
		if (!selected) return
		setSaving(true)
		setError('')
		try {
			const response = await fetch(
				`/api/admin/users/${selected.id}/sessions/revoke-all`,
				{
					method: 'POST',
					headers: createIdempotencyHeaders('admin-user-revoke-sessions'),
				}
			)
			if (!response.ok) {
				throw new Error(await readError(response, 'Failed to revoke sessions'))
			}
			await loadDetail(selected.id)
		} catch (sessionError) {
			setError(
				sessionError instanceof Error
					? sessionError.message
					: 'Failed to revoke sessions'
			)
		} finally {
			setSaving(false)
		}
	}

	async function impersonate() {
		if (!selected) return
		setSaving(true)
		setError('')
		try {
			const response = await fetch(
				`/api/admin/users/${selected.id}/impersonate`,
				{
					method: 'POST',
					headers: createIdempotencyHeaders('admin-user-impersonate'),
				}
			)
			if (!response.ok) {
				throw new Error(await readError(response, 'Failed to impersonate user'))
			}
			window.location.href = '/chat'
		} catch (impersonateError) {
			setError(
				impersonateError instanceof Error
					? impersonateError.message
					: 'Failed to impersonate user'
			)
		} finally {
			setSaving(false)
		}
	}

	useEffect(() => {
		void loadUsers(1)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="grid min-h-screen grid-cols-1 xl:grid-cols-[1fr_440px]">
			<section className="min-w-0 p-4 pb-16 md:p-8">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-3xl font-bold">Users</h1>
						<p className="mt-1 text-sm text-white/60">
							Better Auth plugin-backed user operations with Fork.AI metadata.
						</p>
					</div>
					<Button
						onClick={() => setCreateOpen((value) => !value)}
						className="bg-indigo-600 hover:bg-indigo-500"
					>
						<Plus className="mr-2 h-4 w-4" />
						Create user
					</Button>
				</div>

				{createOpen ? (
					<div className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-[#111] p-4 md:grid-cols-5">
						<input
							value={createEmail}
							onChange={(event) => setCreateEmail(event.target.value)}
							placeholder="Email"
							className="rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
						/>
						<input
							value={createName}
							onChange={(event) => setCreateName(event.target.value)}
							placeholder="Name"
							className="rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
						/>
						<input
							type="password"
							value={createPassword}
							onChange={(event) => setCreatePassword(event.target.value)}
							placeholder="Initial password"
							className="rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
						/>
						<select
							value={createRole}
							onChange={(event) => setCreateRole(event.target.value)}
							className="rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
						>
							<option value="user">User</option>
							<option value="admin">Admin</option>
						</select>
						<Button onClick={createUser} disabled={saving}>
							{saving ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Create
						</Button>
					</div>
				) : null}

				<form
					className="mb-5 flex flex-wrap gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						void loadUsers(1)
					}}
				>
					<div className="relative min-w-72 flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search name or email"
							className="w-full rounded-md border border-white/10 bg-[#111] py-2 pl-9 pr-3 text-sm"
						/>
					</div>
					<select
						value={role}
						onChange={(event) => setRole(event.target.value)}
						className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
					>
						<option value="">All roles</option>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
					<select
						value={banned}
						onChange={(event) => setBanned(event.target.value)}
						className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
					>
						<option value="">All states</option>
						<option value="false">Active</option>
						<option value="true">Banned</option>
					</select>
					<Button
						className="bg-indigo-600 hover:bg-indigo-500"
						disabled={loading}
					>
						{loading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-4 w-4" />
						)}
						Apply
					</Button>
				</form>

				{error ? (
					<p className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
						{error}
					</p>
				) : null}
				<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#111]">
					<table className="w-full min-w-[1100px] text-left text-sm">
						<thead className="border-b border-white/10 text-white/50">
							<tr>
								{['User', 'Role', 'State', 'Usage', 'Counts', 'Created'].map(
									(heading) => (
										<th key={heading} className="px-4 py-3 font-medium">
											{heading}
										</th>
									)
								)}
							</tr>
						</thead>
						<tbody>
							{loading && !payload ? (
								<tr>
									<td
										colSpan={6}
										className="px-4 py-12 text-center text-white/50"
									>
										<Loader2 className="mx-auto h-6 w-6 animate-spin" />
									</td>
								</tr>
							) : payload?.users.length ? (
								payload.users.map((user) => (
									<tr
										key={user.id}
										onClick={() => void loadDetail(user.id)}
										className="cursor-pointer border-b border-white/5 hover:bg-white/[0.04]"
									>
										<td className="px-4 py-3">
											<div className="font-medium">
												{user.email ?? 'No email'}
											</div>
											<div className="text-xs text-white/45">
												{user.name ?? 'No name'} · {user.id}
											</div>
										</td>
										<td className="px-4 py-3">
											<span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs">
												{user.role === 'admin' ? (
													<Shield className="h-3 w-3 text-indigo-300" />
												) : (
													<UserCog className="h-3 w-3" />
												)}
												{user.role}
											</span>
										</td>
										<td className="px-4 py-3">
											{user.banned ? (
												<span className="text-red-300">Banned</span>
											) : (
												<span className="text-emerald-300">Active</span>
											)}
										</td>
										<td className="px-4 py-3">
											<div>
												{fmt(user.currentMonthUsage?.usedTokens ?? 0)} tokens
											</div>
											<div className="text-xs text-white/45">
												${user.currentMonthUsage?.usedUsd ?? '0'}
											</div>
										</td>
										<td className="px-4 py-3 text-white/60">
											{fmt(user._count.conversations)} conv ·{' '}
											{fmt(user._count.usageEvents)} usage ·{' '}
											{fmt(user._count.fileObjects)} files
										</td>
										<td className="px-4 py-3 text-white/60">
											{user.createdAt
												? new Date(user.createdAt).toLocaleDateString()
												: 'Unknown'}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td
										colSpan={6}
										className="px-4 py-12 text-center text-white/50"
									>
										No users found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{payload ? (
					<div className="mt-4 flex items-center justify-between text-sm text-white/60">
						<span>
							Page {payload.pagination.page} of{' '}
							{Math.max(1, payload.pagination.totalPages)} ·{' '}
							{fmt(payload.pagination.total)} users
						</span>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1 || loading}
								onClick={() => void loadUsers(page - 1)}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= payload.pagination.totalPages || loading}
								onClick={() => void loadUsers(page + 1)}
							>
								Next
							</Button>
						</div>
					</div>
				) : null}
			</section>

			<aside className="border-t border-white/10 bg-[#0d0d0d] p-4 md:p-8 xl:border-l xl:border-t-0">
				{detailLoading ? (
					<div className="flex h-48 items-center justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-white/50" />
					</div>
				) : selected ? (
					<div className="space-y-6">
						<div>
							<h2 className="text-xl font-semibold">
								{selected.email ?? 'No email'}
							</h2>
							<p className="mt-1 break-all text-xs text-white/45">
								{selected.id}
							</p>
						</div>
						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="rounded-lg border border-white/10 bg-[#111] p-3">
								<p className="text-white/40">Conversations</p>
								<p className="mt-1 text-xl">
									{fmt(selected._count.conversations)}
								</p>
							</div>
							<div className="rounded-lg border border-white/10 bg-[#111] p-3">
								<p className="text-white/40">Usage events</p>
								<p className="mt-1 text-xl">
									{fmt(selected._count.usageEvents)}
								</p>
							</div>
							<div className="rounded-lg border border-white/10 bg-[#111] p-3">
								<p className="text-white/40">Sessions</p>
								<p className="mt-1 text-xl">
									{fmt(
										selected.sessions?.length ?? selected._count.sessions ?? 0
									)}
								</p>
							</div>
							<div className="rounded-lg border border-white/10 bg-[#111] p-3">
								<p className="text-white/40">Shares</p>
								<p className="mt-1 text-xl">
									{fmt(selected._count.sharedConversations)}
								</p>
							</div>
						</div>
						<div className="space-y-3 rounded-xl border border-white/10 bg-[#111] p-4">
							<h3 className="font-medium">Plugin account controls</h3>
							<label className="block text-sm text-white/60">Role</label>
							<select
								value={editRole}
								onChange={(event) => setEditRole(event.target.value)}
								className="w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
							>
								<option value="user">User</option>
								<option value="admin">Admin</option>
							</select>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={editBanned}
									onChange={(event) => setEditBanned(event.target.checked)}
								/>
								<Ban className="h-4 w-4 text-red-300" />
								Banned
							</label>
							<input
								value={banReason}
								onChange={(event) => setBanReason(event.target.value)}
								placeholder="Ban reason"
								className="w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
							/>
							<input
								type="date"
								value={banExpires}
								onChange={(event) => setBanExpires(event.target.value)}
								className="w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
							/>
							<Button
								onClick={saveUser}
								disabled={saving}
								className="w-full bg-indigo-600 hover:bg-indigo-500"
							>
								{saving ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : null}
								Save role and ban state
							</Button>
						</div>
						<div className="space-y-3 rounded-xl border border-white/10 bg-[#111] p-4">
							<h3 className="font-medium">Password</h3>
							<div className="flex gap-2">
								<input
									type="password"
									value={newPassword}
									onChange={(event) => setNewPassword(event.target.value)}
									placeholder="New password"
									className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm"
								/>
								<Button onClick={setPassword} disabled={saving || !newPassword}>
									<KeyRound className="h-4 w-4" />
								</Button>
							</div>
						</div>
						<div className="space-y-3 rounded-xl border border-white/10 bg-[#111] p-4">
							<div className="flex items-center justify-between gap-3">
								<h3 className="font-medium">Sessions</h3>
								<Button
									variant="outline"
									size="sm"
									onClick={revokeAllSessions}
									disabled={saving}
								>
									Revoke all
								</Button>
							</div>
							<div className="space-y-3">
								{selected.sessions?.length ? (
									selected.sessions.map((session) => (
										<div
											key={session.id}
											className="rounded-md border border-white/10 bg-[#0a0a0a] p-3 text-xs text-white/55"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div>
														{session.createdAt
															? new Date(session.createdAt).toLocaleString()
															: 'Unknown start'}{' '}
														· expires{' '}
														{session.expiresAt
															? new Date(session.expiresAt).toLocaleDateString()
															: 'unknown'}
													</div>
													<div className="truncate">
														{session.ipAddress ?? 'No IP'} ·{' '}
														{session.userAgent ?? 'No user agent'}
													</div>
													{session.impersonatedBy ? (
														<div className="text-amber-200">
															Impersonated by {session.impersonatedBy}
														</div>
													) : null}
												</div>
												<Button
													variant="outline"
													size="sm"
													onClick={() => revokeSession(session.id)}
													disabled={saving}
												>
													Revoke
												</Button>
											</div>
										</div>
									))
								) : (
									<p className="text-sm text-white/50">No sessions.</p>
								)}
							</div>
						</div>
						<Button
							onClick={impersonate}
							disabled={saving || selected.role === 'admin'}
							className="w-full bg-amber-500 text-black hover:bg-amber-400"
						>
							<Eye className="mr-2 h-4 w-4" />
							Impersonate user
						</Button>
					</div>
				) : (
					<div className="rounded-xl border border-white/10 bg-[#111] p-6 text-sm text-white/55">
						Select a user to inspect safe metadata and admin controls.
					</div>
				)}
			</aside>
		</div>
	)
}
