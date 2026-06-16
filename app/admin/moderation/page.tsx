'use client'

import { authClient } from '@/lib/auth-client'
import { Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ModerationReport {
	window: { from: string; to: string }
	totals: {
		moderationEvents: number
		abuseSignals: number
	}
	events: Array<{
		id: string
		userId: string | null
		conversationId: string | null
		messageId: string | null
		fileObjectId: string | null
		sharedConversationId: string | null
		source: string
		stage: string
		category: string
		action: string
		severity: string
		policyVersion: string
		reason: string
		contentHash: string | null
		contentLength: number | null
		createdAt: string
		user: { email: string; name: string } | null
	}>
	signals: Array<{
		id: string
		userId: string | null
		conversationId: string | null
		signalType: string
		severity: string
		action: string
		actorHash: string | null
		count: number
		windowSeconds: number | null
		provider: string | null
		model: string | null
		providerStatusCode: number | null
		createdAt: string
		user: { email: string; name: string } | null
	}>
}

const ACTIONS = ['', 'block', 'review', 'degrade', 'allow']
const CATEGORIES = [
	'',
	'child_safety',
	'violence',
	'self_harm',
	'sexual_content',
	'hate_harassment',
	'illegal_activity',
	'malware',
	'credential_exfiltration',
	'prompt_injection',
	'privacy_spam',
	'file_risk',
	'provider_abuse',
	'signup_abuse',
	'output_risk',
]
const SOURCES = [
	'',
	'chat_message',
	'file_upload',
	'assistant_output',
	'share_snapshot',
	'account_export',
	'signup',
	'rate_limit',
	'provider_response',
]
const SIGNALS = [
	'',
	'prompt_flooding',
	'token_draining',
	'provider_rate_limit',
	'high_failure_rate',
	'suspicious_signup',
	'moderation_block',
	'rate_limit_exceeded',
	'file_scanner_block',
]

export default function AdminModerationPage() {
	const [report, setReport] = useState<ModerationReport | null>(null)
	const [userFilter, setUserFilter] = useState('')
	const [from, setFrom] = useState('')
	const [to, setTo] = useState('')
	const [category, setCategory] = useState('')
	const [action, setAction] = useState('')
	const [source, setSource] = useState('')
	const [signalType, setSignalType] = useState('')
	const [limit, setLimit] = useState('25')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [authorized, setAuthorized] = useState<boolean | null>(null)

	async function loadReport() {
		setLoading(true)
		setError('')
		try {
			const params = new URLSearchParams()
			if (userFilter.trim()) params.set('user', userFilter.trim())
			if (from)
				params.set('from', new Date(`${from}T00:00:00.000Z`).toISOString())
			if (to) {
				const exclusiveTo = new Date(`${to}T00:00:00.000Z`)
				exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1)
				params.set('to', exclusiveTo.toISOString())
			}
			if (category) params.set('category', category)
			if (action) params.set('action', action)
			if (source) params.set('source', source)
			if (signalType) params.set('signalType', signalType)
			params.set('limit', limit)

			const response = await fetch(`/api/admin/moderation?${params.toString()}`)
			if (!response.ok) throw new Error('Failed to load moderation report')
			setReport((await response.json()) as ModerationReport)
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Failed to load moderation report'
			)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void authClient.getSession().then(({ data }) => {
			const isAdmin =
				(data?.user as { role?: string | null } | undefined)?.role === 'admin'
			setAuthorized(isAdmin)
			if (isAdmin) void loadReport()
			else setLoading(false)
		})
		// Initial load intentionally uses default filters.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	if (authorized === false) {
		return <div className="p-8 text-white">Unauthorized</div>
	}

	return (
		<div className="p-8 pb-16 text-white">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Moderation</h1>
				<p className="mt-1 text-white/60">
					Policy and abuse metadata without raw private content.
				</p>
			</div>

			<form
				className="mb-6 flex flex-wrap gap-3"
				onSubmit={(event) => {
					event.preventDefault()
					void loadReport()
				}}
			>
				<input
					value={userFilter}
					onChange={(event) => setUserFilter(event.target.value)}
					placeholder="User ID or email"
					className="min-w-64 rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					type="date"
					value={from}
					onChange={(event) => setFrom(event.target.value)}
					aria-label="From date (UTC)"
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					type="date"
					value={to}
					onChange={(event) => setTo(event.target.value)}
					aria-label="To date (UTC)"
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<select
					value={category}
					onChange={(event) => setCategory(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				>
					{CATEGORIES.map((value) => (
						<option key={value || 'all'} value={value}>
							{value || 'All categories'}
						</option>
					))}
				</select>
				<select
					value={action}
					onChange={(event) => setAction(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				>
					{ACTIONS.map((value) => (
						<option key={value || 'all'} value={value}>
							{value || 'All actions'}
						</option>
					))}
				</select>
				<select
					value={source}
					onChange={(event) => setSource(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				>
					{SOURCES.map((value) => (
						<option key={value || 'all'} value={value}>
							{value || 'All sources'}
						</option>
					))}
				</select>
				<select
					value={signalType}
					onChange={(event) => setSignalType(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				>
					{SIGNALS.map((value) => (
						<option key={value || 'all'} value={value}>
							{value || 'All signals'}
						</option>
					))}
				</select>
				<select
					value={limit}
					onChange={(event) => setLimit(event.target.value)}
					aria-label="Rows per table"
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				>
					<option value="10">10 rows</option>
					<option value="25">25 rows</option>
					<option value="50">50 rows</option>
					<option value="100">100 rows</option>
				</select>
				<button
					type="submit"
					className="flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400"
				>
					<Search className="h-4 w-4" /> Filter
				</button>
			</form>

			{error ? <p className="mb-4 text-red-400">{error}</p> : null}
			{loading ? (
				<div className="flex h-48 items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-white/60" />
				</div>
			) : report ? (
				<div className="space-y-8">
					<div className="grid gap-4 md:grid-cols-2">
						{[
							['Moderation events', report.totals.moderationEvents],
							['Abuse signals', report.totals.abuseSignals],
						].map(([label, value]) => (
							<div
								key={label}
								className="rounded-xl border border-white/10 bg-[#111] p-4"
							>
								<p className="text-xs uppercase tracking-wide text-white/50">
									{label}
								</p>
								<p className="mt-2 text-2xl font-semibold">
									{Number(value).toLocaleString()}
								</p>
							</div>
						))}
					</div>

					<section>
						<h2 className="mb-3 text-xl font-semibold">Policy Events</h2>
						<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#111]">
							<table className="w-full min-w-[1200px] text-left text-sm">
								<thead className="border-b border-white/10 text-white/50">
									<tr>
										{[
											'Time',
											'User',
											'Source / stage',
											'Category',
											'Action',
											'Severity',
											'Reason',
											'Content hash',
											'Related IDs',
										].map((heading) => (
											<th key={heading} className="px-4 py-3 font-medium">
												{heading}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{report.events.map((event) => (
										<tr key={event.id} className="border-b border-white/5">
											<td className="px-4 py-3 text-white/60">
												{new Date(event.createdAt).toLocaleString()}
											</td>
											<td className="px-4 py-3">
												{event.user?.email ?? event.userId ?? 'Anonymous'}
											</td>
											<td className="px-4 py-3">
												{event.source} / {event.stage}
											</td>
											<td className="px-4 py-3">{event.category}</td>
											<td className="px-4 py-3">{event.action}</td>
											<td className="px-4 py-3">{event.severity}</td>
											<td className="max-w-80 px-4 py-3 text-white/70">
												{event.reason}
											</td>
											<td className="px-4 py-3 font-mono text-xs text-white/60">
												{event.contentHash
													? `${event.contentHash.slice(0, 16)}...`
													: '-'}
											</td>
											<td className="px-4 py-3 font-mono text-xs text-white/60">
												{[
													event.conversationId,
													event.messageId,
													event.fileObjectId,
													event.sharedConversationId,
												]
													.filter(Boolean)
													.join(' / ') || '-'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section>
						<h2 className="mb-3 text-xl font-semibold">Abuse Signals</h2>
						<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#111]">
							<table className="w-full min-w-[1000px] text-left text-sm">
								<thead className="border-b border-white/10 text-white/50">
									<tr>
										{[
											'Time',
											'User',
											'Signal',
											'Action',
											'Severity',
											'Window',
											'Provider / model',
											'Actor',
										].map((heading) => (
											<th key={heading} className="px-4 py-3 font-medium">
												{heading}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{report.signals.map((signal) => (
										<tr key={signal.id} className="border-b border-white/5">
											<td className="px-4 py-3 text-white/60">
												{new Date(signal.createdAt).toLocaleString()}
											</td>
											<td className="px-4 py-3">
												{signal.user?.email ?? signal.userId ?? 'Anonymous'}
											</td>
											<td className="px-4 py-3">{signal.signalType}</td>
											<td className="px-4 py-3">{signal.action}</td>
											<td className="px-4 py-3">{signal.severity}</td>
											<td className="px-4 py-3">
												{signal.windowSeconds
													? `${signal.windowSeconds}s`
													: '-'}
											</td>
											<td className="px-4 py-3">
												{signal.provider
													? `${signal.provider} / ${signal.model ?? '-'}`
													: '-'}
											</td>
											<td className="px-4 py-3 font-mono text-xs text-white/60">
												{signal.actorHash
													? `${signal.actorHash.slice(0, 16)}...`
													: '-'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : null}
		</div>
	)
}
