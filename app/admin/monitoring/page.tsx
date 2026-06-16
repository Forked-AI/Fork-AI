'use client'

import { Button } from '@/components/ui/button'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import {
	Activity,
	AlertTriangle,
	Loader2,
	RefreshCw,
	RotateCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface MetricsPayload {
	totals: {
		events: number
		averageDurationMs: number
		averageTtftMs: number
		averageTokensPerSec: number
		totalTokens: number
		costTotal: number
		generationCount: number
		failureCount: number
		provider429Count: number
	}
	alerts: OperationalAlert[]
	breakdowns: Record<string, Array<Record<string, unknown>>>
	recent: Array<{
		id: string
		kind: string
		source: string
		status: string
		route: string | null
		job: string | null
		provider: string | null
		model: string | null
		durationMs: number | null
		errorCode: string | null
		providerStatus: number | null
		traceId: string | null
		createdAt: string
	}>
}

interface QueuePayload {
	alerts: OperationalAlert[]
	queues: Array<{
		name: string
		counts: Record<string, number>
		jobs: {
			failed: Array<{
				id: string
				name: string
				failedReason?: string
				attemptsMade: number
			}>
			waiting: Array<{ id: string; name: string }>
			active: Array<{ id: string; name: string }>
			delayed: Array<{ id: string; name: string }>
		}
	}>
}

interface OperationalAlert {
	code: string
	severity: 'warning' | 'critical'
	title: string
	value: number
	threshold: number
	unit: 'count' | 'percent' | 'usd'
}

function fmt(value: number) {
	return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatAlertValue(alert: OperationalAlert) {
	if (alert.unit === 'percent') return `${fmt(alert.value)}%`
	if (alert.unit === 'usd') return `$${fmt(alert.value)}`
	return fmt(alert.value)
}

export default function AdminMonitoringPage() {
	const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
	const [queues, setQueues] = useState<QueuePayload | null>(null)
	const [from, setFrom] = useState(() => {
		const date = new Date()
		date.setUTCDate(date.getUTCDate() - 7)
		return date.toISOString().slice(0, 10)
	})
	const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
	const [loading, setLoading] = useState(true)
	const [retrying, setRetrying] = useState<string | null>(null)
	const [error, setError] = useState('')

	async function loadMonitoring() {
		setLoading(true)
		setError('')
		try {
			const params = new URLSearchParams()
			if (from)
				params.set('from', new Date(`${from}T00:00:00.000Z`).toISOString())
			if (to) {
				const exclusiveTo = new Date(`${to}T00:00:00.000Z`)
				exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1)
				params.set('to', exclusiveTo.toISOString())
			}
			const [metricsResponse, queueResponse] = await Promise.all([
				fetch(`/api/admin/monitoring/metrics?${params.toString()}`),
				fetch('/api/admin/monitoring/queues'),
			])
			if (!metricsResponse.ok) throw new Error('Failed to load metrics')
			if (!queueResponse.ok) throw new Error('Failed to load queues')
			setMetrics((await metricsResponse.json()) as MetricsPayload)
			setQueues((await queueResponse.json()) as QueuePayload)
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Failed to load monitoring'
			)
		} finally {
			setLoading(false)
		}
	}

	async function retryJob(queue: string, jobId: string) {
		setRetrying(`${queue}:${jobId}`)
		try {
			const response = await fetch(
				`/api/admin/monitoring/queues/${queue}/jobs/${jobId}/retry`,
				{
					method: 'POST',
					headers: createIdempotencyHeaders('admin-queue-retry'),
				}
			)
			if (!response.ok) throw new Error('Failed to retry job')
			await loadMonitoring()
		} catch (retryError) {
			setError(
				retryError instanceof Error ? retryError.message : 'Failed to retry job'
			)
		} finally {
			setRetrying(null)
		}
	}

	useEffect(() => {
		void loadMonitoring()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="p-4 pb-16 md:p-8">
			<div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
				<div>
					<h1 className="text-3xl font-bold">Monitoring</h1>
					<p className="mt-1 text-sm text-white/60">
						Latency, provider, rate-limit, and queue metadata.
					</p>
				</div>
				<form
					className="flex flex-wrap gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						void loadMonitoring()
					}}
				>
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
						className="bg-indigo-600 hover:bg-indigo-500"
						disabled={loading}
					>
						{loading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-4 w-4" />
						)}
						Refresh
					</Button>
				</form>
			</div>

			{error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
			{loading && !metrics ? (
				<div className="flex h-64 items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-white/50" />
				</div>
			) : (
				<div className="space-y-6">
					{[...(metrics?.alerts ?? []), ...(queues?.alerts ?? [])].length ? (
						<div className="grid gap-3 lg:grid-cols-2">
							{[...(metrics?.alerts ?? []), ...(queues?.alerts ?? [])].map(
								(alert) => (
									<div
										key={alert.code}
										className={
											alert.severity === 'critical'
												? 'rounded-xl border border-red-400/30 bg-red-400/10 p-4'
												: 'rounded-xl border border-amber-400/30 bg-amber-400/10 p-4'
										}
									>
										<div className="flex items-start gap-3">
											<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
											<div>
												<p className="font-semibold">{alert.title}</p>
												<p className="mt-1 text-sm text-white/60">
													{formatAlertValue(alert)} against threshold{' '}
													{formatAlertValue({
														...alert,
														value: alert.threshold,
													})}
												</p>
											</div>
										</div>
									</div>
								)
							)}
						</div>
					) : null}
					{metrics ? (
						<>
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
								{[
									['Events', fmt(metrics.totals.events)],
									[
										'Avg duration',
										`${fmt(metrics.totals.averageDurationMs)} ms`,
									],
									['Avg TTFT', `${fmt(metrics.totals.averageTtftMs)} ms`],
									['Tokens/sec', fmt(metrics.totals.averageTokensPerSec)],
									['Metric cost', `$${fmt(metrics.totals.costTotal)}`],
								].map(([label, value]) => (
									<div
										key={label}
										className="rounded-xl border border-white/10 bg-[#111] p-4"
									>
										<p className="text-xs uppercase text-white/40">{label}</p>
										<p className="mt-2 text-2xl font-semibold">{value}</p>
									</div>
								))}
							</div>
							<div className="grid gap-4 xl:grid-cols-3">
								{['byKind', 'byStatus', 'byProvider'].map((key) => (
									<div
										key={key}
										className="rounded-xl border border-white/10 bg-[#111] p-4"
									>
										<h2 className="mb-3 font-semibold">
											{key.replace('by', 'By ')}
										</h2>
										<div className="space-y-2 text-sm">
											{(metrics.breakdowns[key] ?? [])
												.slice(0, 8)
												.map((row, index) => (
													<div
														key={index}
														className="flex justify-between gap-3"
													>
														<span className="truncate text-white/60">
															{String(
																row.kind ??
																	row.status ??
																	row.provider ??
																	'unknown'
															)}
															{row.source ? ` / ${String(row.source)}` : ''}
															{row.model ? ` / ${String(row.model)}` : ''}
														</span>
														<span className="font-mono">
															{Number(
																(row._count as { _all?: number } | undefined)
																	?._all ?? 0
															).toLocaleString()}
														</span>
													</div>
												))}
										</div>
									</div>
								))}
							</div>
						</>
					) : null}

					<div className="grid gap-6 xl:grid-cols-3">
						{queues?.queues.map((queue) => (
							<div
								key={queue.name}
								className="rounded-xl border border-white/10 bg-[#111] p-4"
							>
								<h2 className="mb-3 flex items-center gap-2 font-semibold">
									<Activity className="h-4 w-4 text-indigo-300" />
									{queue.name}
								</h2>
								<div className="grid grid-cols-3 gap-2 text-center text-xs">
									{['waiting', 'active', 'failed'].map((key) => (
										<div key={key} className="rounded-lg bg-white/[0.04] p-2">
											<p className="text-white/40">{key}</p>
											<p className="text-lg font-semibold">
												{queue.counts[key] ?? 0}
											</p>
										</div>
									))}
								</div>
								<div className="mt-4 space-y-2">
									{queue.jobs.failed.length ? (
										queue.jobs.failed.map((job) => (
											<div
												key={job.id}
												className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm"
											>
												<div className="flex items-center justify-between gap-3">
													<span className="truncate">
														{job.name} · {job.id}
													</span>
													<button
														type="button"
														onClick={() => void retryJob(queue.name, job.id)}
														disabled={retrying === `${queue.name}:${job.id}`}
														className="rounded-md border border-white/10 p-1.5 hover:bg-white/10 disabled:opacity-50"
														aria-label="Retry job"
													>
														{retrying === `${queue.name}:${job.id}` ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<RotateCcw className="h-4 w-4" />
														)}
													</button>
												</div>
												<p className="mt-1 text-xs text-red-100/60">
													{job.failedReason ?? 'No failure reason'}
												</p>
											</div>
										))
									) : (
										<p className="text-sm text-white/45">
											No recent failed jobs.
										</p>
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
										'Kind',
										'Source',
										'Status',
										'Target',
										'Duration',
										'Error',
										'Trace',
									].map((heading) => (
										<th key={heading} className="px-4 py-3 font-medium">
											{heading}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{metrics?.recent.length ? (
									metrics.recent.map((metric) => (
										<tr key={metric.id} className="border-b border-white/5">
											<td className="px-4 py-3 text-white/60">
												{new Date(metric.createdAt).toLocaleString()}
											</td>
											<td className="px-4 py-3">{metric.kind}</td>
											<td className="px-4 py-3">{metric.source}</td>
											<td className="px-4 py-3">{metric.status}</td>
											<td className="px-4 py-3">
												{metric.route ?? metric.job ?? metric.provider ?? '-'}
											</td>
											<td className="px-4 py-3">
												{metric.durationMs ? `${metric.durationMs} ms` : '-'}
											</td>
											<td className="px-4 py-3">
												{metric.errorCode ?? metric.providerStatus ?? '-'}
											</td>
											<td className="px-4 py-3 font-mono text-xs text-white/50">
												{metric.traceId ?? '-'}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td
											colSpan={8}
											className="px-4 py-12 text-center text-white/50"
										>
											No metrics found.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	)
}
