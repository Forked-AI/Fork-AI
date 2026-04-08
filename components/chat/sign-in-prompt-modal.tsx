'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import { Button } from '@/components/ui/button'
import { LogIn, UserPlus } from 'lucide-react'
import Link from 'next/link'

interface SignInPromptModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SignInPromptModal({
	open,
	onOpenChange,
}: SignInPromptModalProps) {
	return (
		<ChatModalShell
			open={open}
			onOpenChange={onOpenChange}
			title="Sign In to Save Your Conversations"
			description="You're currently using Fork.AI as a guest. Sign in to save your conversations and access them anytime."
			icon={<LogIn className="h-5 w-5 text-[#57FCFF]" />}
			contentClassName="sm:max-w-md"
		>
			<div className="space-y-4 py-2">
				<p className="text-center text-sm text-muted-foreground">
					As a guest, you can chat with AI models, but your conversations
					won&apos;t be saved. Create an account to keep your chat history, fork
					conversations, and explore different response paths.
				</p>

				<div className="flex flex-col gap-3 pt-4">
					<Link href="/login" className="w-full">
						<Button className="w-full bg-[#57FCFF] font-medium text-black hover:bg-[#57FCFF]/90">
							<LogIn className="mr-2 h-4 w-4" />
							Sign In
						</Button>
					</Link>

					<Link href="/signup" className="w-full">
						<Button
							variant="outline"
							className="w-full border-[#57FCFF]/20 hover:bg-[#57FCFF]/10"
						>
							<UserPlus className="mr-2 h-4 w-4" />
							Create Account
						</Button>
					</Link>
				</div>
			</div>
		</ChatModalShell>
	)
}
