'use client'

import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Search, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ToolExecutionPayload {
	total: number
	breakdowns: {
		byStatus: Array<{ status: string; _count: { _all: number } }>
		byTool: Array<{ toolName: string; _count: { _all: number } }>
	}
	executions: Array<{
		id: string
		userId: string
		organizationId: string | null
		conversationId: string | null
		messageId: string | null
		toolName: string
		status: string
		riskLevel: string
		requiresConfirmation: boolean
		confirmedAt: string | null
		inputSummaryJson: Record<string, unknown> | null
		resultSummary: {
			present: boolean
			untrusted: boolean
			truncated: boolean
			displayTextLength: number
			metadata: Record<string, unknown>
		}
		auditMetadata: Record<string, unknown> | null
		errorCode: string | null
		startedAt: string | null
		completedAt: string | null
		createdAt: string
	}>
}

function shortId(value: string | null) {
	if (!value) return '—'
	return value.length > 12 ? `${value.slice(0, 12)}…` : value
}

function fmtDate(value: string | null) {
	if (!value) return '—'
	return new Date(value).toLocaleString()
}

function safeJson(value: Record<string, unknown> | null) {
	if (!value) return '—'
	return JSON.stringify(value)
}

export default function AdminToolsPage() {
	const [payload, setPayload] = useState<ToolExecutionPayload | null>(null)
	const [toolName, setToolName] = useState('')
	const [status, setStatus] = useState('')
	const [from, setFrom] = useState(() => {
		const date = new Date()
		date.setUTCDate(date.getUTCDate() - 7)
		return date.toISOString().slice(0, 10)
	})
	const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	async function loadTools() {
		setLoading(true)
		setError('')
		try {
			const params = new URLSearchParams({ limit: '50' })
			if (toolName.trim()) params.set('toolName', toolName.trim())
			if (status.trim()) params.set('status', status.trim())
			if (from)
				params.set('from', new Date(`${from}T00:00:00.000Z`).toISOString())
			if (to) {
				const exclusiveTo = new Date(`${to}T00:00:00.000Z`)
				exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1)
				params.set('to', exclusiveTo.toISOString())
			}
			const response = await fetch(
				`/api/admin/tools/executions?${params.toString()}`
			)
			if (!response.ok) throw new Error('Failed to load tool executions')
			setPayload((await response.json()) as ToolExecutionPayload)
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Failed to load tool executions'
			)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void loadTools()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="p-4 pb-16 md:p-8">
			<div className="mb-6">
				<h1 className="flex items-center gap-2 text-3xl font-bold">
					<Wrench className="h-7 w-7 text-cyan-300" />
					Tool Executions
				</h1>
				<p className="mt-1 text-sm text-white/60">
					Metadata-only tool audit records and confirmation outcomes.
				</p>
			</div>

			<div className="mb-6 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5">
				<input
					value={toolName}
					onChange={(event) => setToolName(event.target.value)}
					placeholder="Tool name"
					className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
				/>
				<input
					value={status}
					onChange={(event) => setStatus(event.target.value)}
					placeholder="Status"
					className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
				/>
				<input
					type="date"
					value={from}
					onChange={(event) => setFrom(event.target.value)}
					className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
				/>
				<input
					type="date"
					value={to}
					onChange={(event) => setTo(event.target.value)}
					className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
				/>
				<Button onClick={loadTools} disabled={loading}>
					{loading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Search className="mr-2 h-4 w-4" />
					)}
					Search
				</Button>
			</div>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
					{error}
				</div>
			) : null}

			<div className="mb-4 flex items-center justify-between">
				<div className="text-sm text-white/60">
					{payload ? `${payload.total.toLocaleString()} executions` : 'Loading'}
				</div>
				<Button variant="outline" size="sm" onClick={loadTools}>
					<RefreshCw className="mr-2 h-4 w-4" />
					Refresh
				</Button>
			</div>

			<div className="overflow-x-auto rounded-xl border border-white/10">
				<table className="min-w-full divide-y divide-white/10 text-sm">
					<thead className="bg-white/[0.04] text-left text-white/60">
						<tr>
							<th className="px-4 py-3 font-medium">Created</th>
							<th className="px-4 py-3 font-medium">Tool</th>
							<th className="px-4 py-3 font-medium">Status</th>
							<th className="px-4 py-3 font-medium">Risk</th>
							<th className="px-4 py-3 font-medium">User</th>
							<th className="px-4 py-3 font-medium">Conversation</th>
							<th className="px-4 py-3 font-medium">Input Summary</th>
							<th className="px-4 py-3 font-medium">Result Summary</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-white/10">
						{loading ? (
							<tr>
								<td colSpan={8} className="px-4 py-8 text-center text-white/60">
									<Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
									Loading tool executions
								</td>
							</tr>
						) : payload?.executions.length ? (
							payload.executions.map((execution) => (
								<tr key={execution.id} className="align-top">
									<td className="whitespace-nowrap px-4 py-3 text-white/70">
										{fmtDate(execution.createdAt)}
									</td>
									<td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
										{execution.toolName}
									</td>
									<td className="whitespace-nowrap px-4 py-3">
										{execution.status}
										{execution.errorCode ? (
											<div className="text-xs text-red-200">
												{execution.errorCode}
											</div>
										) : null}
									</td>
									<td className="whitespace-nowrap px-4 py-3">
										{execution.riskLevel}
										{execution.requiresConfirmation ? (
											<div className="text-xs text-amber-200">
												{execution.confirmedAt ? 'confirmed' : 'not confirmed'}
											</div>
										) : null}
									</td>
									<td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
										{shortId(execution.userId)}
									</td>
									<td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
										{shortId(execution.conversationId)}
									</td>
									<td className="max-w-xs px-4 py-3 font-mono text-xs text-white/70">
										{safeJson(execution.inputSummaryJson)}
									</td>
									<td className="max-w-xs px-4 py-3 font-mono text-xs text-white/70">
										{safeJson(execution.resultSummary)}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={8} className="px-4 py-8 text-center text-white/60">
									No tool executions found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
