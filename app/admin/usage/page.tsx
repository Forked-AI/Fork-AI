'use client'

import { authClient } from '@/lib/auth-client'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import { Download, Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

interface UsageReport {
	window: { from: string; to: string }
	totals: {
		events: number
		inputTokens: number
		outputTokens: number
		billableUnits: number
		estimatedCostUsd: string
	}
	events: Array<{
		id: string
		userId: string | null
		conversationId: string | null
		feature: string
		outcome: string
		provider: string
		requestedModel: string
		resolvedModel: string | null
		billableUnits: number
		estimatedCostUsd: string | null
		usageSource: string | null
		errorCode: string | null
		createdAt: string
		user: { email: string; name: string } | null
	}>
	breakdowns?: {
		byProvider: Array<{
			provider: string
			model: string
			events: number
			billableUnits: number
			estimatedCostUsd: string
		}>
		byOutcome: Array<{ outcome: string; events: number; billableUnits: number }>
		byFeature: Array<{ feature: string; events: number; billableUnits: number }>
	}
	nextCursor: string | null
}

export default function AdminUsagePage() {
	const [report, setReport] = useState<UsageReport | null>(null)
	const [userFilter, setUserFilter] = useState('')
	const [from, setFrom] = useState('')
	const [to, setTo] = useState('')
	const [provider, setProvider] = useState('')
	const [model, setModel] = useState('')
	const [outcome, setOutcome] = useState('')
	const [limit, setLimit] = useState('25')
	const [cursor, setCursor] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [exporting, setExporting] = useState(false)
	const [error, setError] = useState('')
	const [authorized, setAuthorized] = useState<boolean | null>(null)

	async function loadUsage(nextCursor: string | null = null) {
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
			if (provider.trim()) params.set('provider', provider.trim())
			if (model.trim()) params.set('model', model.trim())
			if (outcome) params.set('outcome', outcome)
			params.set('limit', limit)
			if (nextCursor) params.set('cursor', nextCursor)
			const response = await fetch(`/api/admin/usage?${params.toString()}`)
			if (!response.ok) throw new Error('Failed to load usage report')
			setReport((await response.json()) as UsageReport)
			setCursor(nextCursor)
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Failed to load usage report'
			)
		} finally {
			setLoading(false)
		}
	}

	function buildParams() {
		const params = new URLSearchParams()
		if (userFilter.trim()) params.set('user', userFilter.trim())
		if (from)
			params.set('from', new Date(`${from}T00:00:00.000Z`).toISOString())
		if (to) {
			const exclusiveTo = new Date(`${to}T00:00:00.000Z`)
			exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1)
			params.set('to', exclusiveTo.toISOString())
		}
		if (provider.trim()) params.set('provider', provider.trim())
		if (model.trim()) params.set('model', model.trim())
		if (outcome) params.set('outcome', outcome)
		return params
	}

	async function exportUsage() {
		setExporting(true)
		setError('')
		try {
			const params = buildParams()
			params.set('limit', '5000')
			const response = await fetch(
				`/api/admin/usage/export?${params.toString()}`,
				{
					headers: createIdempotencyHeaders('admin-usage-export'),
				}
			)
			if (!response.ok) throw new Error('Failed to export usage')
			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			const link = document.createElement('a')
			link.href = url
			link.download = `usage-export-${new Date().toISOString().split('T')[0]}.csv`
			document.body.appendChild(link)
			link.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(link)
		} catch (exportError) {
			setError(
				exportError instanceof Error
					? exportError.message
					: 'Failed to export usage'
			)
		} finally {
			setExporting(false)
		}
	}

	useEffect(() => {
		void authClient.getSession().then(({ data }) => {
			const isAdmin =
				(data?.user as { role?: string | null } | undefined)?.role === 'admin'
			setAuthorized(isAdmin)
			if (isAdmin) void loadUsage()
			else setLoading(false)
		})
		// Initial load intentionally uses the empty default filters.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	if (authorized === false) {
		return <div className="p-8 text-white">Unauthorized</div>
	}

	return (
		<div className="p-8 pb-16 text-white">
			<div className="mb-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div>
						<h1 className="text-3xl font-bold">AI Usage</h1>
						<p className="mt-1 text-white/60">
							Auditable model usage without prompt or message content.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void exportUsage()}
						disabled={exporting}
						className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
					>
						{exporting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						Export CSV
					</button>
				</div>
			</div>

			<form
				className="mb-6 flex flex-wrap gap-3"
				onSubmit={(event) => {
					event.preventDefault()
					void loadUsage()
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
				<input
					value={provider}
					onChange={(event) => setProvider(event.target.value)}
					placeholder="Provider"
					className="min-w-36 rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<input
					value={model}
					onChange={(event) => setModel(event.target.value)}
					placeholder="Requested or resolved model"
					className="min-w-56 rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				/>
				<select
					value={outcome}
					onChange={(event) => setOutcome(event.target.value)}
					className="rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm"
				>
					<option value="">All outcomes</option>
					<option value="completed">Completed</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
					<option value="moderated">Moderated</option>
					<option value="pending">Pending</option>
				</select>
				<select
					value={limit}
					onChange={(event) => setLimit(event.target.value)}
					aria-label="Rows per page"
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
				<>
					<div className="mb-6 grid gap-4 md:grid-cols-4">
						{[
							['Events', report.totals.events.toLocaleString()],
							['Input tokens', report.totals.inputTokens.toLocaleString()],
							['Output tokens', report.totals.outputTokens.toLocaleString()],
							['Estimated USD', `$${report.totals.estimatedCostUsd}`],
						].map(([label, value]) => (
							<div
								key={label}
								className="rounded-xl border border-white/10 bg-[#111] p-4"
							>
								<p className="text-xs uppercase tracking-wide text-white/50">
									{label}
								</p>
								<p className="mt-2 text-2xl font-semibold">{value}</p>
							</div>
						))}
					</div>

					<div className="mb-6 grid gap-4 xl:grid-cols-3">
						{[
							['Provider / model', report.breakdowns?.byProvider ?? []],
							['Outcome', report.breakdowns?.byOutcome ?? []],
							['Feature', report.breakdowns?.byFeature ?? []],
						].map(([title, rows]) => (
							<div
								key={title as string}
								className="rounded-xl border border-white/10 bg-[#111] p-4"
							>
								<h2 className="mb-3 text-sm font-semibold text-white/80">
									{title as string}
								</h2>
								<div className="space-y-2">
									{(rows as Array<Record<string, unknown>>).length ? (
										(rows as Array<Record<string, unknown>>)
											.slice(0, 6)
											.map((row, index) => (
												<div
													key={index}
													className="flex items-center justify-between gap-3 text-sm"
												>
													<span className="truncate text-white/60">
														{String(row.provider ?? row.outcome ?? row.feature)}
														{row.model ? ` / ${String(row.model)}` : ''}
													</span>
													<span className="font-mono">
														{Number(row.events ?? 0).toLocaleString()}
													</span>
												</div>
											))
									) : (
										<p className="text-sm text-white/45">No rows.</p>
									)}
								</div>
							</div>
						))}
					</div>

					<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#111]">
						<table className="w-full min-w-[1100px] text-left text-sm">
							<thead className="border-b border-white/10 text-white/50">
								<tr>
									{[
										'Time',
										'User',
										'Feature',
										'Outcome',
										'Provider / model',
										'Tokens',
										'Cost',
										'Conversation',
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
											{event.user?.email ?? event.userId ?? 'System'}
										</td>
										<td className="px-4 py-3">{event.feature}</td>
										<td className="px-4 py-3">{event.outcome}</td>
										<td className="px-4 py-3">
											{event.provider} /{' '}
											{event.resolvedModel ?? event.requestedModel}
										</td>
										<td className="px-4 py-3">
											{event.billableUnits.toLocaleString()} (
											{event.usageSource})
										</td>
										<td className="px-4 py-3">
											{event.estimatedCostUsd
												? `$${event.estimatedCostUsd}`
												: 'Unknown'}
										</td>
										<td className="px-4 py-3 font-mono text-xs text-white/60">
											{event.conversationId ?? '-'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="mt-4 flex justify-end gap-2">
						<button
							disabled={!cursor}
							onClick={() => void loadUsage()}
							className="rounded-md border border-white/10 px-3 py-2 text-sm disabled:opacity-40"
						>
							First page
						</button>
						<button
							disabled={!report.nextCursor}
							onClick={() => void loadUsage(report.nextCursor)}
							className="rounded-md border border-white/10 px-3 py-2 text-sm disabled:opacity-40"
						>
							Next page
						</button>
					</div>
				</>
			) : null}
		</div>
	)
}
