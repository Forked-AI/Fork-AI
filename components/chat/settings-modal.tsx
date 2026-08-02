'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/hooks/use-settings'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import {
	normalizeKeyboardEvent,
	shortcutLabelParts,
	stringifyShortcut,
	validateShortcut,
} from '@/lib/keyboard-shortcuts'
import { resolveEffectiveTheme, resolveThemePalette } from '@/lib/theme-engine'
import {
	Check,
	ChevronRight,
	CreditCard,
	Download,
	Keyboard,
	Link2Off,
	MessageSquare,
	Moon,
	Palette,
	PanelLeft,
	RotateCcw,
	Settings as SettingsIcon,
	Shield,
	Sparkles,
	Trash2,
	Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ChatBehaviorModal } from './chat-behavior-modal'
import { ThemeCustomizationModal } from './theme-customization-modal'

interface SettingsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	compactMode: boolean
	onCompactModeChange: (compact: boolean) => void
}

interface SettingsSwitchRowProps {
	id: string
	label: string
	description?: string
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function SettingsSwitchRow({
	id,
	label,
	description,
	checked,
	onCheckedChange,
}: SettingsSwitchRowProps) {
	return (
		<Field
			orientation="horizontal"
			className="items-start justify-between gap-4 rounded-lg border border-border/40 bg-sidebar/20 px-3 py-2.5"
		>
			<FieldContent className="gap-0.5">
				<FieldLabel
					htmlFor={id}
					className="w-auto text-sm font-medium text-foreground"
				>
					{label}
				</FieldLabel>
				{description ? (
					<FieldDescription className="text-xs text-muted-foreground">
						{description}
					</FieldDescription>
				) : null}
			</FieldContent>
			<Switch
				id={id}
				checked={checked}
				onCheckedChange={onCheckedChange}
				className="mt-0.5 data-[state=checked]:bg-primary"
			/>
		</Field>
	)
}

export function SettingsModal({
	open,
	onOpenChange,
	compactMode,
	onCompactModeChange,
}: SettingsModalProps) {
	const { settings, updateSettings, resetToDefaults } = useSettings()
	const { resolvedTheme } = useTheme()
	const [showSaved, setShowSaved] = useState(false)
	const [themeModalOpen, setThemeModalOpen] = useState(false)
	const [chatBehaviorModalOpen, setChatBehaviorModalOpen] = useState(false)
	const [shortcutRecording, setShortcutRecording] = useState(false)
	const [shortcutError, setShortcutError] = useState<string | null>(null)
	const [privacyActionBusy, setPrivacyActionBusy] = useState<string | null>(
		null
	)
	const [privacyActionStatus, setPrivacyActionStatus] = useState<string | null>(
		null
	)
	const previewTheme =
		resolveEffectiveTheme(settings.theme, resolvedTheme) ?? 'dark'
	const previewPalette = resolveThemePalette(settings, previewTheme)

	const showSavedIndicator = () => {
		setShowSaved(true)
		setTimeout(() => setShowSaved(false), 2000)
	}

	const handleCompactModeToggle = (checked: boolean) => {
		onCompactModeChange(checked)
		updateSettings({ compactMode: checked })
		showSavedIndicator()
	}

	const handleTruncateLengthChange = (value: string) => {
		updateSettings({ messageTruncateLength: Number.parseInt(value, 10) })
		showSavedIndicator()
	}

	const handleKeybindingChange = (value: 'enter' | 'ctrl-enter') => {
		updateSettings({ sendKeybinding: value })
		showSavedIndicator()
	}

	const handleShortcutCapture = (
		event: ReactKeyboardEvent<HTMLInputElement>
	) => {
		if (!shortcutRecording) return

		event.preventDefault()
		event.stopPropagation()

		if (event.key === 'Escape') {
			setShortcutRecording(false)
			setShortcutError(null)
			return
		}

		const combo = normalizeKeyboardEvent(event.nativeEvent)
		const validation = validateShortcut(combo)
		if (!validation.valid) {
			setShortcutError(validation.message ?? 'Choose another shortcut.')
			return
		}

		updateSettings({ recentChatSwitcherShortcut: stringifyShortcut(combo) })
		setShortcutRecording(false)
		setShortcutError(null)
		showSavedIndicator()
	}

	const handleFeatureToggle = (
		feature: keyof typeof settings.enabledFeatures,
		checked: boolean
	) => {
		updateSettings({
			enabledFeatures: {
				...settings.enabledFeatures,
				[feature]: checked,
			},
		})
		showSavedIndicator()
	}

	const handleResetAll = () => {
		if (confirm('Reset all settings to defaults? This cannot be undone.')) {
			resetToDefaults()
			showSavedIndicator()
		}
	}

	const downloadAccountExport = async (format: 'json' | 'markdown') => {
		setPrivacyActionBusy(`export-${format}`)
		setPrivacyActionStatus(null)
		try {
			const queueResponse = await fetch('/api/account/export', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders(`account-export-${format}`),
				},
				body: JSON.stringify({ format }),
			})

			if (!queueResponse.ok) {
				throw new Error('Export queue failed')
			}

			const queuePayload = (await queueResponse.json()) as {
				jobId?: string
			}

			if (!queuePayload.jobId) {
				throw new Error('Export job was not returned')
			}

			setPrivacyActionStatus('Preparing account export...')

			let response: Response | null = null
			for (let attempt = 0; attempt < 60; attempt += 1) {
				response = await fetch(
					`/api/account/export/jobs/${encodeURIComponent(queuePayload.jobId)}`
				)

				if (response.status === 200) {
					break
				}

				if (response.status !== 202) {
					throw new Error('Export generation failed')
				}

				await wait(1000)
			}

			if (!response || response.status !== 200) {
				throw new Error('Export generation timed out')
			}

			const blob = await response.blob()
			const contentDisposition =
				response.headers.get('Content-Disposition') ?? ''
			const filenameMatch = /filename="([^"]+)"/.exec(contentDisposition)
			const filename =
				filenameMatch?.[1] ??
				`fork-ai-account-export.${format === 'markdown' ? 'md' : 'json'}`
			const url = URL.createObjectURL(blob)
			const anchor = document.createElement('a')
			anchor.href = url
			anchor.download = filename
			document.body.appendChild(anchor)
			anchor.click()
			anchor.remove()
			URL.revokeObjectURL(url)
			setPrivacyActionStatus('Account export downloaded.')
		} catch {
			setPrivacyActionStatus('Unable to export account data right now.')
		} finally {
			setPrivacyActionBusy(null)
		}
	}

	const revokeAllShares = async () => {
		if (
			!confirm(
				'Revoke all active share links? Existing links will stop working.'
			)
		) {
			return
		}

		setPrivacyActionBusy('revoke-shares')
		setPrivacyActionStatus(null)
		try {
			const response = await fetch('/api/account/shares/revoke', {
				method: 'POST',
				headers: createIdempotencyHeaders('shares-revoke'),
			})
			const payload = await response.json().catch(() => null)
			if (!response.ok) {
				throw new Error('Revoke failed')
			}

			setPrivacyActionStatus(
				`Revoked ${payload?.revokedCount ?? 0} active share link${
					payload?.revokedCount === 1 ? '' : 's'
				}.`
			)
		} catch {
			setPrivacyActionStatus('Unable to revoke share links right now.')
		} finally {
			setPrivacyActionBusy(null)
		}
	}

	const deleteAccount = async () => {
		const confirmation = prompt(
			'Type DELETE to permanently delete your account.'
		)
		if (confirmation !== 'DELETE') {
			return
		}

		setPrivacyActionBusy('delete-account')
		setPrivacyActionStatus(null)
		try {
			const response = await fetch('/api/account/delete', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('account-delete'),
				},
				body: JSON.stringify({ confirmation }),
			})
			if (!response.ok) {
				throw new Error('Delete failed')
			}

			localStorage.clear()
			window.location.href = '/'
		} catch {
			setPrivacyActionStatus('Unable to delete account right now.')
			setPrivacyActionBusy(null)
		}
	}

	const keyboardShortcuts = [
		{ keys: ['Ctrl', 'I'], description: 'Focus input' },
		{ keys: ['Cmd', 'B'], description: 'Toggle sidebar' },
		{ keys: ['Cmd', '/'], description: 'Open settings' },
		{
			keys: shortcutLabelParts(settings.recentChatSwitcherShortcut),
			description: 'Switch recent chat',
		},
		{ keys: ['Esc'], description: 'Close modal' },
		{ keys: ['Shift', 'Enter'], description: 'New line in message' },
		{ keys: ['Cmd', 'K'], description: 'Search conversations' },
	]

	return (
		<>
			<ChatModalShell
				open={open}
				onOpenChange={onOpenChange}
				title="Preferences"
				description="Customize your ForkAI experience"
				icon={<SettingsIcon className="h-5 w-5 text-primary" />}
				contentClassName="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
				headerTrailing={
					showSaved ? (
						<span className="inline-flex items-center gap-1 text-xs text-primary">
							<Check className="h-3 w-3" />
							Saved locally
						</span>
					) : null
				}
			>
				<div className="space-y-6">
					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<Palette className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Appearance
							</h3>
						</div>

						<div className="space-y-3 pl-6">
							<button
								onClick={() => setThemeModalOpen(true)}
								className="group flex w-full items-center justify-between rounded-lg border border-border/50 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
							>
								<div className="flex-1">
									<div className="mb-1 flex items-center gap-2">
										<p className="text-sm font-medium">Customize Palette</p>
										{settings.activePreset && (
											<span className="text-xs text-muted-foreground">
												({settings.activePreset})
											</span>
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										Colors, gradients, and visual effects
									</p>
								</div>
								<div className="flex items-center gap-3">
									<div className="flex items-center gap-1.5">
										<div
											className="h-5 w-5 rounded-md border border-white/20"
											style={{
												background: previewPalette.themeChatBackground,
											}}
											title="Background"
										/>
										<div
											className="h-4 w-4 rounded-full border border-white/20"
											style={{ backgroundColor: previewPalette.themePrimary }}
											title="Primary"
										/>
										<div
											className="h-3 w-3 rounded-full border border-white/20"
											style={{
												backgroundColor: previewPalette.themeSecondary,
											}}
											title="Secondary"
										/>
									</div>
									<ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
								</div>
							</button>

							<Field
								orientation="horizontal"
								className="items-start justify-between gap-4 rounded-lg border border-border/40 bg-sidebar/20 px-3 py-2.5"
							>
								<FieldContent className="gap-0.5">
									<FieldLabel className="w-auto text-sm font-medium text-foreground">
										Appearance Mode
									</FieldLabel>
									<FieldDescription className="text-xs text-muted-foreground">
										{settings.theme === 'system'
											? 'Follow system'
											: settings.theme === 'dark'
												? 'Dark'
												: 'Light'}
									</FieldDescription>
								</FieldContent>
								<Select
									value={settings.theme}
									onValueChange={(value: 'dark' | 'light' | 'system') => {
										updateSettings({ theme: value })
										showSavedIndicator()
									}}
								>
									<SelectTrigger className="w-32 border-border/50 bg-sidebar/30">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-border/50 bg-popover">
										<SelectItem value="dark">Dark</SelectItem>
										<SelectItem value="light">Light</SelectItem>
										<SelectItem value="system">System</SelectItem>
									</SelectContent>
								</Select>
							</Field>

							<p className="text-xs text-muted-foreground">
								Light mode uses an auto-derived version of your palette. Dark
								mode uses your saved palette directly.
							</p>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<Zap className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Chat Behavior
							</h3>
						</div>

						<div className="space-y-3 pl-6">
							<button
								onClick={() => setChatBehaviorModalOpen(true)}
								className="group flex w-full items-center justify-between rounded-lg border border-border/50 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
							>
								<div className="flex-1">
									<p className="mb-1 text-sm font-medium">
										Configure AI Behavior
									</p>
									<p className="text-xs text-muted-foreground">
										Temperature: {settings.chatTemperature.toFixed(1)} •
										{settings.systemPrompt
											? ' Custom prompt set'
											: ' No prompt'}
									</p>
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
							</button>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<Sparkles className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Feature Toggles
							</h3>
						</div>

						<div className="space-y-4 pl-6">
							<div className="space-y-3">
								<p className="text-xs font-medium text-muted-foreground">
									Chat UI
								</p>
								<SettingsSwitchRow
									id="settings-show-timestamps"
									label="Show Timestamps"
									checked={settings.enabledFeatures.showMessageTimestamps}
									onCheckedChange={(checked) =>
										handleFeatureToggle('showMessageTimestamps', checked)
									}
								/>
								<SettingsSwitchRow
									id="settings-markdown-preview"
									label="Markdown Preview"
									checked={settings.enabledFeatures.enableMarkdownPreview}
									onCheckedChange={(checked) =>
										handleFeatureToggle('enableMarkdownPreview', checked)
									}
								/>
								<SettingsSwitchRow
									id="settings-token-count"
									label="Show Token Count"
									checked={settings.enabledFeatures.showTokenCount}
									onCheckedChange={(checked) =>
										handleFeatureToggle('showTokenCount', checked)
									}
								/>
							</div>

							<div className="space-y-3 pt-2">
								<p className="text-xs font-medium text-muted-foreground">
									System
								</p>
								<SettingsSwitchRow
									id="settings-auto-save"
									label="Auto-Save Conversations"
									checked={settings.enabledFeatures.autoSaveConversations}
									onCheckedChange={(checked) =>
										handleFeatureToggle('autoSaveConversations', checked)
									}
								/>
								<SettingsSwitchRow
									id="settings-sound-effects"
									label="Sound Effects"
									checked={settings.enabledFeatures.enableSoundEffects}
									onCheckedChange={(checked) =>
										handleFeatureToggle('enableSoundEffects', checked)
									}
								/>
							</div>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<Moon className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Appearance
							</h3>
						</div>

						<div className="space-y-4 pl-6" />
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<PanelLeft className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Sidebar
							</h3>
						</div>

						<div className="space-y-4 pl-6">
							<SettingsSwitchRow
								id="compact"
								label="Compact Mode"
								description="Show only icons in the sidebar"
								checked={compactMode}
								onCheckedChange={handleCompactModeToggle}
							/>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<MessageSquare className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Chat Preferences
							</h3>
						</div>

						<div className="space-y-4 pl-6">
							<div className="space-y-2">
								<Label
									htmlFor="truncate"
									className="text-sm font-medium text-foreground"
								>
									Message Truncate Length
								</Label>
								<p className="mb-2 text-xs text-muted-foreground">
									Long user messages will be collapsed beyond this length
								</p>
								<Select
									value={settings.messageTruncateLength.toString()}
									onValueChange={handleTruncateLengthChange}
								>
									<SelectTrigger
										id="truncate"
										className="w-full border-border/50 bg-sidebar/30"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-border/50 bg-popover">
										<SelectItem value="150">150 characters</SelectItem>
										<SelectItem value="200">200 characters</SelectItem>
										<SelectItem value="300">300 characters</SelectItem>
										<SelectItem value="400">400 characters</SelectItem>
										<SelectItem value="500">500 characters</SelectItem>
										<SelectItem value="1000">1000 characters</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="keybinding"
									className="text-sm font-medium text-foreground"
								>
									Send Message Keybinding
								</Label>
								<p className="mb-2 text-xs text-muted-foreground">
									Choose how to send messages
								</p>
								<Select
									value={settings.sendKeybinding}
									onValueChange={(value) =>
										handleKeybindingChange(value as 'enter' | 'ctrl-enter')
									}
								>
									<SelectTrigger
										id="keybinding"
										className="w-full border-border/50 bg-sidebar/30"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-border/50 bg-popover">
										<SelectItem value="enter">
											<div className="flex flex-col items-start">
												<span className="font-medium">Enter to send</span>
												<span className="text-xs text-muted-foreground">
													Shift+Enter for new line
												</span>
											</div>
										</SelectItem>
										<SelectItem value="ctrl-enter">
											<div className="flex flex-col items-start">
												<span className="font-medium">Ctrl+Enter to send</span>
												<span className="text-xs text-muted-foreground">
													Enter for new line
												</span>
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<CreditCard className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Billing
							</h3>
						</div>

						<div className="space-y-3 pl-6">
							<button
								onClick={() => {
									onOpenChange(false)
									window.location.href = '/chat/billing'
								}}
								className="group flex w-full items-center justify-between rounded-lg border border-border/50 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
							>
								<div className="flex-1">
									<p className="mb-1 text-sm font-medium">Plan & usage</p>
									<p className="text-xs text-muted-foreground">
										Manage subscription and view usage status
									</p>
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
							</button>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<Shield className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Data & Privacy
							</h3>
						</div>

						<div className="space-y-3 pl-6">
							<div className="grid gap-2 sm:grid-cols-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => downloadAccountExport('json')}
									disabled={privacyActionBusy !== null}
									className="justify-start"
								>
									<Download className="h-4 w-4" />
									Export JSON
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => downloadAccountExport('markdown')}
									disabled={privacyActionBusy !== null}
									className="justify-start"
								>
									<Download className="h-4 w-4" />
									Export Markdown
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={revokeAllShares}
									disabled={privacyActionBusy !== null}
									className="justify-start"
								>
									<Link2Off className="h-4 w-4" />
									Revoke Shares
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={deleteAccount}
									disabled={privacyActionBusy !== null}
									className="justify-start"
								>
									<Trash2 className="h-4 w-4" />
									Delete Account
								</Button>
							</div>
							{privacyActionStatus ? (
								<p className="text-xs text-muted-foreground">
									{privacyActionStatus}
								</p>
							) : null}
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2 border-b border-border/50 pb-2">
							<Keyboard className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Keyboard Shortcuts
							</h3>
						</div>

						<div className="space-y-4 pl-6">
							<div className="rounded-lg border border-border/50 p-3">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
									<div className="flex-1 space-y-2">
										<Label
											htmlFor="recent-chat-shortcut"
											className="text-sm font-medium text-foreground"
										>
											Recent Chat Switcher
										</Label>
										<Input
											id="recent-chat-shortcut"
											readOnly
											value={
												shortcutRecording
													? 'Press shortcut...'
													: settings.recentChatSwitcherShortcut
											}
											onKeyDown={handleShortcutCapture}
											onBlur={() => setShortcutRecording(false)}
											aria-invalid={shortcutError ? true : undefined}
											className="font-mono"
										/>
									</div>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setShortcutRecording(true)
											setShortcutError(null)
											requestAnimationFrame(() => {
												document.getElementById('recent-chat-shortcut')?.focus()
											})
										}}
									>
										Record shortcut
									</Button>
								</div>
								<p className="mt-2 text-xs text-muted-foreground">
									Hold the modifier and press the trigger again to cycle.
									Release the modifier to open the highlighted chat.
								</p>
								{shortcutError ? (
									<p className="mt-2 text-xs text-destructive">
										{shortcutError}
									</p>
								) : null}
							</div>
							{keyboardShortcuts.map((shortcut, index) => (
								<div
									key={index}
									className="flex items-center justify-between py-2 text-sm"
								>
									<span className="text-muted-foreground">
										{shortcut.description}
									</span>
									<div className="flex items-center gap-1">
										{shortcut.keys.map((key, i) => (
											<span key={i} className="flex items-center gap-1">
												<kbd className="rounded border border-border bg-sidebar px-2 py-1 text-xs font-mono">
													{key}
												</kbd>
												{i < shortcut.keys.length - 1 && (
													<span className="text-muted-foreground">+</span>
												)}
											</span>
										))}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="flex items-center justify-between pt-2">
						<Button
							variant="destructive"
							size="sm"
							onClick={handleResetAll}
							className="gap-2"
						>
							<RotateCcw className="h-4 w-4" />
							Reset All to Defaults
						</Button>
					</div>

					<div className="rounded-lg border border-border/50 bg-sidebar/30 p-4">
						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">Note:</span>{' '}
							Settings are stored locally in your browser and sync instantly
							across the chat UI.
						</p>
					</div>
				</div>
			</ChatModalShell>

			<ThemeCustomizationModal
				open={themeModalOpen}
				onOpenChange={setThemeModalOpen}
				settings={settings}
				updateSettings={updateSettings}
				showSavedIndicator={showSavedIndicator}
			/>

			<ChatBehaviorModal
				open={chatBehaviorModalOpen}
				onOpenChange={setChatBehaviorModalOpen}
			/>
		</>
	)
}
