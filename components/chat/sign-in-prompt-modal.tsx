'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/80 backdrop-blur-xl border border-[#57FCFF]/20 sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-foreground flex items-center gap-2">
						<LogIn className="w-5 h-5 text-[#57FCFF]" />
					Sign In to Save Your Conversations
				</DialogTitle>
				<DialogDescription className="text-muted-foreground">
					You're currently using Fork.AI as a guest. Sign in to save your
					conversations and access them anytime.
				</DialogDescription>
			</DialogHeader>

			<div className="py-6 space-y-4">
			<p className="text-sm text-muted-foreground text-center">
				As a guest, you can chat with AI models, but your conversations
				won't be saved. Create an account to keep your chat history, fork
				conversations, and explore different response paths.
			</p>

			<div className="flex flex-col gap-3 pt-4">
				<Link href="/login" className="w-full">
					<Button className="w-full bg-[#57FCFF] hover:bg-[#57FCFF]/90 text-black font-medium">
						<LogIn className="w-4 h-4 mr-2" />
						Sign In
					</Button>
				</Link>

				<Link href="/signup" className="w-full">
					<Button
						variant="outline"
						className="w-full border-[#57FCFF]/20 hover:bg-[#57FCFF]/10"
					>
						<UserPlus className="w-4 h-4 mr-2" />
						Create Account
					</Button>
				</Link>
			</div>
		</div>
			</DialogContent>
		</Dialog>
	)
}
