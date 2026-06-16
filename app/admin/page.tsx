'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
	Activity,
	AlertTriangle,
	BarChart3,
	Database,
	FileText,
	Loader2,
	RefreshCw,
	ShieldAlert,
	Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface OverviewPayload {
	window: { from: string; to: string }
	summary: {
		users: number
		admins: number
		bannedUsers: number
		waitlist: number
		conversations: number
		usageEvents: number
		failedUsageEvents: number
		inputTokens: number
		outputTokens: number
		billableUnits: number
		estimatedCostUsd: string
		moderationEvents: number
		abuseSignals: number
		operationalMetrics: number
		averageDurationMs: number
		averageTtftMs: number
	}
	files: Array<{ status: string; count: number }>
	recentMetrics: Array<{
		id: string
		kind: string
		source: string
		status: string
		route: string | null
		job: string | null
		provider: string | null
		model: string | null
		errorCode: string | null
		providerStatus: number | null
		createdAt: string
	}>
	recentAudit: Array<{
		id: string
		action: string
		targetType: string
		targetId: string | null
		createdAt: string
		actor?: { email?: string | null; name?: string | null } | null
	}>
}

function fmt(value: number) {
	return value.toLocaleString()
}

function dateInput(date: Date) {
	return date.toISOString().slice(0, 10)
}

export default function AdminOverviewPage() {
	const [data, setData] = useState<OverviewPayload | null>(null)
	const [from, setFrom] = useState(() => {
		const date = new Date()
		date.setUTCDate(date.getUTCDate() - 30)
		return dateInput(date)
	})
	const [to, setTo] = useState(() => dateInput(new Date()))
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	async function loadOverview() {
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
			const response = await fetch(`/api/admin/overview?${params.toString()}`)
			if (!response.ok) throw new Error('Failed to load overview')
			setData((await response.json()) as OverviewPayload)
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Failed to load overview'
			)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void loadOverview()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const cards = data
		? [
				{
					label: 'Users',
					value: fmt(data.summary.users),
					icon: Users,
					tone: 'text-sky-300',
				},
				{
					label: 'Usage events',
					value: fmt(data.summary.usageEvents),
					icon: BarChart3,
					tone: 'text-indigo-300',
				},
				{
					label: 'Estimated cost',
					value: `$${data.summary.estimatedCostUsd}`,
					icon: Database,
					tone: 'text-emerald-300',
				},
				{
					label: 'Failures',
					value: fmt(data.summary.failedUsageEvents),
					icon: AlertTriangle,
					tone: 'text-amber-300',
				},
				{
					label: 'Moderation',
					value: fmt(data.summary.moderationEvents),
					icon: ShieldAlert,
					tone: 'text-rose-300',
				},
				{
					label: 'Metrics',
					value: fmt(data.summary.operationalMetrics),
					icon: Activity,
					tone: 'text-cyan-300',
				},
			]
		: []

	return (
		<div className="p-4 pb-16 md:p-8">
			<div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
				<div>
					<h1 className="text-3xl font-bold">Operations Overview</h1>
					<p className="mt-1 text-sm text-white/60">
						Metadata-only health, usage, launch, and admin activity.
					</p>
				</div>
				<form
					className="flex flex-wrap items-center gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						void loadOverview()
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
			{loading && !data ? (
				<div className="flex h-64 items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-white/50" />
				</div>
			) : data ? (
				<div className="space-y-6">
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
						{cards.map((card) => (
							<Card key={card.label} className="border-white/10 bg-[#111]">
								<CardHeader className="flex flex-row items-center justify-between pb-2">
									<CardTitle className="text-sm text-white/60">
										{card.label}
									</CardTitle>
									<card.icon className={`h-4 w-4 ${card.tone}`} />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-semibold">{card.value}</div>
								</CardContent>
							</Card>
						))}
					</div>

					<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
						<Card className="border-white/10 bg-[#111]">
							<CardHeader>
								<CardTitle>Operational Signals</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-4 md:grid-cols-3">
								<div>
									<p className="text-xs uppercase text-white/40">
										Billable units
									</p>
									<p className="mt-1 text-xl font-semibold">
										{fmt(data.summary.billableUnits)}
									</p>
								</div>
								<div>
									<p className="text-xs uppercase text-white/40">
										Avg duration
									</p>
									<p className="mt-1 text-xl font-semibold">
										{fmt(data.summary.averageDurationMs)} ms
									</p>
								</div>
								<div>
									<p className="text-xs uppercase text-white/40">Avg TTFT</p>
									<p className="mt-1 text-xl font-semibold">
										{fmt(data.summary.averageTtftMs)} ms
									</p>
								</div>
							</CardContent>
						</Card>

						<Card className="border-white/10 bg-[#111]">
							<CardHeader>
								<CardTitle>Files</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								{data.files.length ? (
									data.files.map((file) => (
										<div
											key={file.status}
											className="flex items-center justify-between text-sm"
										>
											<span className="flex items-center gap-2 text-white/60">
												<FileText className="h-4 w-4" />
												{file.status}
											</span>
											<span className="font-mono">{fmt(file.count)}</span>
										</div>
									))
								) : (
									<p className="text-sm text-white/50">No file records yet.</p>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-6 xl:grid-cols-2">
						<Card className="border-white/10 bg-[#111]">
							<CardHeader>
								<CardTitle>Recent Non-success Metrics</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{data.recentMetrics.length ? (
									data.recentMetrics.map((metric) => (
										<div
											key={metric.id}
											className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
										>
											<div className="flex items-center justify-between gap-3 text-sm">
												<span className="font-medium">
													{metric.kind} / {metric.source}
												</span>
												<span className="text-white/50">
													{new Date(metric.createdAt).toLocaleString()}
												</span>
											</div>
											<p className="mt-1 text-xs text-white/50">
												{metric.status}{' '}
												{metric.errorCode ? `- ${metric.errorCode}` : ''}{' '}
												{metric.providerStatus
													? `(${metric.providerStatus})`
													: ''}
											</p>
										</div>
									))
								) : (
									<p className="text-sm text-white/50">
										No non-success metrics in this window.
									</p>
								)}
							</CardContent>
						</Card>

						<Card className="border-white/10 bg-[#111]">
							<CardHeader>
								<CardTitle>Recent Admin Audit</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{data.recentAudit.length ? (
									data.recentAudit.map((event) => (
										<div
											key={event.id}
											className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
										>
											<div className="flex items-center justify-between gap-3 text-sm">
												<span className="font-medium">{event.action}</span>
												<span className="text-white/50">
													{new Date(event.createdAt).toLocaleString()}
												</span>
											</div>
											<p className="mt-1 text-xs text-white/50">
												{event.actor?.email ??
													event.actor?.name ??
													'Unknown admin'}{' '}
												-&gt; {event.targetType}
												{event.targetId ? `:${event.targetId}` : ''}
											</p>
										</div>
									))
								) : (
									<p className="text-sm text-white/50">
										No audit events in this window.
									</p>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			) : null}
		</div>
	)
}
