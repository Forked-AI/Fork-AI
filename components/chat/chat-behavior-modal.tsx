'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useSettings } from '@/hooks/use-settings'
import { Zap } from 'lucide-react'

interface ChatBehaviorModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function ChatBehaviorModal({
	open,
	onOpenChange,
}: ChatBehaviorModalProps) {
	const { settings, updateSettings } = useSettings()

	const handleTemperatureChange = (value: number[]) => {
		updateSettings({ chatTemperature: value[0] })
	}

	const handleSystemPromptChange = (value: string) => {
		updateSettings({ systemPrompt: value })
	}

	const getTemperatureLabel = (temp: number): string => {
		if (temp <= 0.5) return 'Focused'
		if (temp <= 1.0) return 'Balanced'
		return 'Creative'
	}

	const getTemperatureDescription = (temp: number): string => {
		if (temp <= 0.5) {
			return 'More deterministic and consistent responses. Best for factual questions and precise tasks.'
		}
		if (temp <= 1.0) {
			return 'Balanced creativity and consistency. Good for general conversation and varied tasks.'
		}
		return 'More creative and diverse responses. Best for brainstorming and creative writing.'
	}

	const systemPromptTemplates = [
		{
			name: 'Professional',
			prompt:
				'You are a professional assistant. Provide clear, concise, and well-structured responses. Use formal language and cite sources when applicable.',
		},
		{
			name: 'Casual',
			prompt:
				'You are a friendly and casual assistant. Use a conversational tone and feel free to use emojis when appropriate.',
		},
		{
			name: 'Technical',
			prompt:
				'You are a technical expert. Provide detailed, accurate explanations with code examples when relevant. Assume the user has technical knowledge.',
		},
		{
			name: 'Concise',
			prompt:
				'You are a concise assistant. Keep responses brief and to the point. Use bullet points when appropriate.',
		},
	]

	return (
		<ChatModalShell
			open={open}
			onOpenChange={onOpenChange}
			title="Chat Behavior"
			description="Configure how the AI responds to your messages"
			icon={<Zap className="h-5 w-5 text-[#57FCFF]" />}
			backAction={() => onOpenChange(false)}
			contentClassName="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
		>
			<div className="space-y-6">
				<Field className="space-y-3 rounded-lg border border-border/50 bg-sidebar/20 p-4">
					<div className="flex items-center justify-between">
						<FieldLabel className="w-auto text-sm font-medium">
							Temperature
						</FieldLabel>
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">
								{settings.chatTemperature.toFixed(1)}
							</span>
							<span className="text-xs font-medium text-[#57FCFF]">
								{getTemperatureLabel(settings.chatTemperature)}
							</span>
						</div>
					</div>
					<Slider
						value={[settings.chatTemperature]}
						onValueChange={handleTemperatureChange}
						min={0}
						max={2}
						step={0.1}
						className="w-full"
					/>
					<div className="flex justify-between px-1 text-[10px] text-muted-foreground">
						<span>0.0 - Focused</span>
						<span>1.0 - Balanced</span>
						<span>2.0 - Creative</span>
					</div>
					<div className="rounded-lg border border-border/50 bg-sidebar/30 p-3">
						<p className="text-xs text-muted-foreground">
							{getTemperatureDescription(settings.chatTemperature)}
						</p>
					</div>
				</Field>

				<Field className="space-y-3 rounded-lg border border-border/50 bg-sidebar/20 p-4">
					<FieldContent className="gap-1.5">
						<div className="flex items-center justify-between">
							<FieldLabel
								htmlFor="system-prompt"
								className="w-auto text-sm font-medium"
							>
								System Prompt
							</FieldLabel>
							<span className="text-xs text-muted-foreground">
								{settings.systemPrompt.length}/500
							</span>
						</div>
						<FieldDescription className="text-xs text-muted-foreground">
							Custom instructions that shape the AI&apos;s personality and
							behavior
						</FieldDescription>
					</FieldContent>
					<Textarea
						id="system-prompt"
						value={settings.systemPrompt}
						onChange={(e) => handleSystemPromptChange(e.target.value)}
						placeholder="e.g., You are a helpful technical assistant who explains concepts clearly..."
						maxLength={500}
						rows={5}
						className="resize-none font-mono text-sm"
					/>

					<div className="space-y-2">
						<Label className="text-xs font-medium text-muted-foreground">
							Quick Templates
						</Label>
						<div className="grid grid-cols-2 gap-2">
							{systemPromptTemplates.map((template) => (
								<button
									key={template.name}
									onClick={() => handleSystemPromptChange(template.prompt)}
									className="rounded-lg border border-border/50 p-2 text-left transition-all hover:border-[#57FCFF]/50 hover:bg-[#57FCFF]/5"
								>
									<p className="text-xs font-medium">{template.name}</p>
									<p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
										{template.prompt}
									</p>
								</button>
							))}
						</div>
					</div>
				</Field>

				<div className="rounded-lg border border-border/50 bg-sidebar/30 p-3">
					<p className="text-xs text-muted-foreground">
						<span className="font-semibold text-foreground">Note:</span> These
						settings apply globally to all new conversations. Changes won&apos;t
						affect existing conversations.
					</p>
				</div>
			</div>
		</ChatModalShell>
	)
}
