'use client'

import { Button } from '@/components/ui/button'
import { ClipboardList, Loader2, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AuditPayload {
	total: number
	events: Array<{
		id: string
		actorId: string
		action: string
		targetType: string
		targetId: string | null
		requestId: string | null
		idempotencyKey: string | null
		metadataJson: Record<string, unknown> | null
		createdAt: string
		actor?: { email?: string | null; name?: string | null } | null
	}>
	nextCursor: string | null
}

export default function AdminAuditPage() {
	const [payload, setPayload] = useState<AuditPayload | null>(null)
	const [actor, setActor] = useState('')
	const [action, setAction] = useState('')
	const [targetType, setTargetType] = useState('')
	const [from, setFrom] = useState(() => {
		const date = new Date()
		date.setUTCDate(date.getUTCDate() - 30)
		return date.toISOString().slice(0, 10)
	})
	const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
	const [cursor, setCursor] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	async function loadAudit(nextCursor: string | null = null) {
		setLoading(true)
		setError('')
		try {
			const params = new URLSearchParams({ limit: '25' })
			if (actor.trim()) params.set('actor', actor.trim())
			if (action.trim()) params.set('action', action.trim())
			if (targetType.trim()) params.set('targetType', targetType.trim())
			if (from)
				params.set('from', new Date(`${from}T00:00:00.000Z`).toISOString())
			if (to) {
				const exclusiveTo = new Date(`${to}T00:00:00.000Z`)
				exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1)
				params.set('to', exclusiveTo.toISOString())
			}
			if (nextCursor) params.set('cursor', nextCursor)
			const response = await fetch(`/api/admin/audit?${params.toString()}`)
			if (!response.ok) throw new Error('Failed to load audit')
			setPayload((await response.json()) as AuditPayload)
			setCursor(nextCursor)
		} catch (loadError) {
			setError(
				loadError instanceof Error ? loadError.message : 'Failed to load audit'
			)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void loadAudit()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="p-4 pb-16 md:p-8">
			<div className="mb-6">
				<h1 className="flex items-center gap-2 text-3xl font-bold">
					<ClipboardList className="h-7 w-7 text-indigo-300" />
					Admin Audit
				</h1>
				<p className="mt-1 text-sm text-white/60">
					Trace role changes, bans, exports, waitlist deletes, and queue
					retries.
				</p>
			</div>

			<form
				className="mb-5 flex flex-wrap gap-3"
				onSubmit={(event) => {
					event.preventDefault()
					void loadAudit()
				}}
			>
				<input
					value={actor}
					onChange={(event) => setActor(event.target.value)}
					placeholder="Actor ID or email"
					className="min-w-64 rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					value={action}
					onChange={(event) => setAction(event.target.value)}
					placeholder="Action"
					className="min-w-44 rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					value={targetType}
					onChange={(event) => setTargetType(event.target.value)}
					placeholder="Target type"
					className="min-w-44 rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					type="date"
					value={from}
					onChange={(event) => setFrom(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					type="date"
					value={to}
					onChange={(event) => setTo(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<Button
					disabled={loading}
					className="bg-indigo-600 hover:bg-indigo-500"
				>
					{loading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Search className="mr-2 h-4 w-4" />
					)}
					Filter
				</Button>
			</form>

			{error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
			<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#111]">
				<table className="w-full min-w-[1100px] text-left text-sm">
					<thead className="border-b border-white/10 text-white/50">
						<tr>
							{[
								'Time',
								'Actor',
								'Action',
								'Target',
								'Request',
								'Idempotency',
								'Metadata',
							].map((heading) => (
								<th key={heading} className="px-4 py-3 font-medium">
									{heading}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{loading && !payload ? (
							<tr>
								<td colSpan={7} className="px-4 py-12 text-center">
									<Loader2 className="mx-auto h-6 w-6 animate-spin text-white/50" />
								</td>
							</tr>
						) : payload?.events.length ? (
							payload.events.map((event) => (
								<tr key={event.id} className="border-b border-white/5">
									<td className="px-4 py-3 text-white/60">
										{new Date(event.createdAt).toLocaleString()}
									</td>
									<td className="px-4 py-3">
										{event.actor?.email ?? event.actor?.name ?? event.actorId}
									</td>
									<td className="px-4 py-3">{event.action}</td>
									<td className="px-4 py-3 font-mono text-xs text-white/60">
										{event.targetType}
										{event.targetId ? `:${event.targetId}` : ''}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-white/60">
										{event.requestId ?? '-'}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-white/60">
										{event.idempotencyKey ?? '-'}
									</td>
									<td className="max-w-xs truncate px-4 py-3 text-xs text-white/50">
										{event.metadataJson
											? JSON.stringify(event.metadataJson)
											: '-'}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td
									colSpan={7}
									className="px-4 py-12 text-center text-white/50"
								>
									No audit events found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			<div className="mt-4 flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={!cursor || loading}
					onClick={() => void loadAudit()}
				>
					First page
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!payload?.nextCursor || loading}
					onClick={() => void loadAudit(payload?.nextCursor ?? null)}
				>
					{loading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="mr-2 h-4 w-4" />
					)}
					Next page
				</Button>
			</div>
		</div>
	)
}
