'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import { Button } from '@/components/ui/button'
import { GitBranch, Loader2, MessageSquare, Network, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface ForkPlaygroundModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	conversationId: string | null
	conversationTitle?: string | null
	onOpenForkView: (conversationId: string) => void
}

interface TreeMessage {
	id: string
	role: string
	content: string
	parentMessageId: string | null
	createdAt?: string
}

interface TreePayload {
	messages: TreeMessage[]
	tree: Record<string, string[]>
}

function getPreview(content: string) {
	const normalized = content.replace(/\s+/g, ' ').trim()
	return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

export function ForkPlaygroundModal({
	open,
	onOpenChange,
	conversationId,
	conversationTitle,
	onOpenForkView,
}: ForkPlaygroundModalProps) {
	const [payload, setPayload] = useState<TreePayload | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !conversationId) {
			setPayload(null)
			setError(null)
			setIsLoading(false)
			return
		}

		let cancelled = false
		setIsLoading(true)
		setError(null)

		fetch(`/api/conversations/${conversationId}/tree`, {
			credentials: 'include',
		})
			.then(async (response) => {
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as {
						error?: string
					} | null
					throw new Error(body?.error ?? 'Failed to load branches')
				}

				return response.json() as Promise<TreePayload>
			})
			.then((nextPayload) => {
				if (!cancelled) {
					setPayload(nextPayload)
				}
			})
			.catch((nextError: unknown) => {
				if (!cancelled) {
					setError(
						nextError instanceof Error
							? nextError.message
							: 'Failed to load branches'
					)
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false)
				}
			})

		return () => {
			cancelled = true
		}
	}, [conversationId, open])

	const stats = useMemo(() => {
		if (!payload) {
				return {
					messageCount: 0,
					forkPathCount: 0,
					branchingPointCount: 0,
					branchingMessages: [] as TreeMessage[],
				}
		}

		const messageById = new Map(
			payload.messages.map((message) => [message.id, message])
		)
			const branchingEntries = Object.entries(payload.tree).filter(
				([, childIds]) => childIds.length > 1
			)
			const branchingParentIds = branchingEntries
				.map(([parentId]) => parentId)
				.filter((parentId) => parentId !== 'null')

			return {
				messageCount: payload.messages.length,
				forkPathCount: branchingEntries.reduce(
					(total, [, childIds]) => total + childIds.length,
					0
				),
				branchingPointCount: branchingEntries.length,
				branchingMessages: branchingParentIds
					.map((messageId) => messageById.get(messageId))
					.filter((message): message is TreeMessage => Boolean(message))
				.slice(0, 5),
		}
	}, [payload])

	const canOpenForkView = Boolean(conversationId)

	return (
		<ChatModalShell
			open={open}
			onOpenChange={onOpenChange}
			title="Fork Playground"
			description={
				conversationTitle
					? `Explore branches inside "${conversationTitle}".`
					: conversationId
						? 'Explore branches inside the active chat.'
						: 'Open a chat to inspect its forks and branch paths.'
			}
			icon={<GitBranch className="h-5 w-5 text-[#57FCFF]" />}
			contentClassName="sm:max-w-2xl"
		>
			{!conversationId ? (
				<div className="rounded-xl border border-border/60 bg-background/30 p-6 text-center">
					<MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
					<h3 className="text-sm font-medium text-foreground">
						No active conversation
					</h3>
					<p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
						Choose a chat first, then use Branches to open its Fork Playground.
					</p>
				</div>
			) : isLoading ? (
				<div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/30 p-8 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin text-primary" />
					Loading branch tree...
				</div>
			) : error ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
					<div className="flex items-center gap-2 text-sm font-medium text-destructive">
						<XCircle className="h-4 w-4" />
						{error}
					</div>
				</div>
			) : (
				<div className="space-y-5">
					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-xl border border-border/60 bg-background/30 p-4">
							<p className="text-xs uppercase tracking-wider text-muted-foreground">
								Messages
							</p>
							<p
								className="mt-1 text-2xl font-semibold text-foreground"
								data-testid="fork-playground-message-count"
							>
								{stats.messageCount}
							</p>
						</div>
							<div className="rounded-xl border border-border/60 bg-background/30 p-4">
							<p className="text-xs uppercase tracking-wider text-muted-foreground">
								Fork paths
							</p>
							<p
								className="mt-1 text-2xl font-semibold text-foreground"
								data-testid="fork-playground-fork-path-count"
							>
								{stats.forkPathCount}
							</p>
						</div>
						<div className="rounded-xl border border-border/60 bg-background/30 p-4">
							<p className="text-xs uppercase tracking-wider text-muted-foreground">
								Branch points
							</p>
							<p
								className="mt-1 text-2xl font-semibold text-foreground"
								data-testid="fork-playground-branch-point-count"
							>
								{stats.branchingPointCount}
							</p>
						</div>
					</div>

					<div className="rounded-xl border border-border/60 bg-background/30 p-4">
						<div className="mb-3 flex items-center gap-2">
							<Network className="h-4 w-4 text-primary" />
							<h3 className="text-sm font-medium text-foreground">
								Recent branch points
							</h3>
						</div>
						{stats.branchingMessages.length > 0 ? (
							<div className="space-y-2">
								{stats.branchingMessages.map((message) => (
									<div
										key={message.id}
										className="rounded-lg border border-border/40 bg-background/40 px-3 py-2"
									>
										<div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
											<span>{message.role}</span>
											<span>{payload?.tree[message.id]?.length ?? 0} paths</span>
										</div>
										<p className="text-sm text-foreground">
											{getPreview(message.content)}
										</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								This chat does not have sibling branches yet. Create an
								alternative from any message to compare paths here.
							</p>
						)}
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
						<Button
							onClick={() => {
								if (conversationId) {
									onOpenForkView(conversationId)
								}
							}}
							disabled={!canOpenForkView}
						>
							Open Fork view
						</Button>
					</div>
				</div>
			)}
		</ChatModalShell>
	)
}
