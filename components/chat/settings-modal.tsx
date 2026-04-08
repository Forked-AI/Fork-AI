'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
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
import {
	resolveEffectiveTheme,
	resolveThemePalette,
} from '@/lib/theme-engine'
import {
	Check,
	ChevronRight,
	Keyboard,
	MessageSquare,
	Moon,
	Palette,
	PanelLeft,
	RotateCcw,
	Settings as SettingsIcon,
	Sparkles,
	Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
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
				<FieldLabel htmlFor={id} className="w-auto text-sm font-medium text-foreground">
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

	const keyboardShortcuts = [
		{ keys: ['Ctrl', 'I'], description: 'Focus input' },
		{ keys: ['Cmd', 'B'], description: 'Toggle sidebar' },
		{ keys: ['Cmd', '/'], description: 'Open settings' },
		{ keys: ['Esc'], description: 'Close modal' },
		{ keys: ['Shift', 'Enter'], description: 'New line in message' },
		{ keys: ['Cmd', 'K'], description: 'Command palette (coming soon)' },
	]

	return (
		<>
			<ChatModalShell
				open={open}
				onOpenChange={onOpenChange}
				title="Preferences"
				description="Customize your Fork AI experience"
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
									<p className="mb-1 text-sm font-medium">Configure AI Behavior</p>
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
							<Keyboard className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
								Keyboard Shortcuts
							</h3>
						</div>

						<div className="space-y-2 pl-6">
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
