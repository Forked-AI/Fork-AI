'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
import { useState } from 'react'
import { ChatBehaviorModal } from './chat-behavior-modal'
import { ThemeCustomizationModal } from './theme-customization-modal'

interface SettingsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	compactMode: boolean
	onCompactModeChange: (compact: boolean) => void
}

export function SettingsModal({
	open,
	onOpenChange,
	compactMode,
	onCompactModeChange,
}: SettingsModalProps) {
	const { settings, updateSettings, resetToDefaults } = useSettings()
	const [showSaved, setShowSaved] = useState(false)
	const [themeModalOpen, setThemeModalOpen] = useState(false)
	const [chatBehaviorModalOpen, setChatBehaviorModalOpen] = useState(false)

	const handleCompactModeToggle = (checked: boolean) => {
		onCompactModeChange(checked)
		updateSettings({ compactMode: checked })
		showSavedIndicator()
	}

	const handleTruncateLengthChange = (value: string) => {
		updateSettings({ messageTruncateLength: parseInt(value) })
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

	const showSavedIndicator = () => {
		setShowSaved(true)
		setTimeout(() => setShowSaved(false), 2000)
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/80 backdrop-blur-xl border border-primary/20 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-foreground flex items-center gap-2">
						<SettingsIcon className="w-5 h-5 text-primary" />
						Preferences
					</DialogTitle>
					<DialogDescription className="text-muted-foreground flex items-center gap-2">
						Customize your Fork AI experience
						{showSaved && (
							<span className="inline-flex items-center gap-1 text-xs text-primary">
								<Check className="w-3 h-3" />
								Saved locally
							</span>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Theme Section - Simplified */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<Palette className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
								Theme
							</h3>
						</div>

						<div className="space-y-3 pl-6">
							<button
								onClick={() => setThemeModalOpen(true)}
								className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
							>
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<p className="text-sm font-medium">Customize Theme</p>
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
										{/* Show theme preview: background, primary, secondary */}
										<div
											className="w-5 h-5 rounded-md border border-white/20"
											style={{ backgroundColor: settings.themeBackground }}
											title="Background"
										/>
										<div
											className="w-4 h-4 rounded-full border border-white/20"
											style={{ backgroundColor: settings.themePrimary }}
											title="Primary"
										/>
										<div
											className="w-3 h-3 rounded-full border border-white/20"
											style={{ backgroundColor: settings.themeSecondary }}
											title="Secondary"
										/>
									</div>
									<ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
							</button>

							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-sm font-medium">Theme Mode</Label>
									<p className="text-xs text-muted-foreground">
										{settings.theme === 'system'
											? 'Follow system'
											: settings.theme === 'dark'
												? 'Dark'
												: 'Light'}
									</p>
								</div>
								<Select
									value={settings.theme}
									onValueChange={(value: 'dark' | 'light' | 'system') => {
										updateSettings({ theme: value })
										showSavedIndicator()
									}}
								>
									<SelectTrigger className="w-32 bg-sidebar/30 border-border/50">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-[#0a0d11]/95 backdrop-blur-xl border-border/50">
										<SelectItem value="dark">Dark</SelectItem>
										<SelectItem value="light">Light</SelectItem>
										<SelectItem value="system">System</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>

					{/* Chat Behavior Section - Simplified */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<Zap className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
								Chat Behavior
							</h3>
						</div>

						<div className="space-y-3 pl-6">
							<button
								onClick={() => setChatBehaviorModalOpen(true)}
								className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
							>
								<div className="flex-1">
									<p className="text-sm font-medium mb-1">
										Configure AI Behavior
									</p>
									<p className="text-xs text-muted-foreground">
										Temperature: {settings.chatTemperature.toFixed(1)} •
										{settings.systemPrompt
											? ' Custom prompt set'
											: ' No prompt'}
									</p>
								</div>
								<ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
							</button>
						</div>
					</div>

					{/* Feature Toggles Section */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<Sparkles className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
								Feature Toggles
							</h3>
						</div>

						<div className="space-y-4 pl-6">
							<div className="space-y-3">
								<p className="text-xs font-medium text-muted-foreground">
									Chat UI
								</p>

								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">Show Timestamps</Label>
									<Switch
										checked={settings.enabledFeatures.showMessageTimestamps}
										onCheckedChange={(checked) =>
											handleFeatureToggle('showMessageTimestamps', checked)
										}
										className="data-[state=checked]:bg-primary"
									/>
								</div>

								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">
										Markdown Preview
									</Label>
									<Switch
										checked={settings.enabledFeatures.enableMarkdownPreview}
										onCheckedChange={(checked) =>
											handleFeatureToggle('enableMarkdownPreview', checked)
										}
										className="data-[state=checked]:bg-primary"
									/>
								</div>

								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">
										Show Token Count
									</Label>
									<Switch
										checked={settings.enabledFeatures.showTokenCount}
										onCheckedChange={(checked) =>
											handleFeatureToggle('showTokenCount', checked)
										}
										className="data-[state=checked]:bg-primary"
									/>
								</div>
							</div>

							<div className="space-y-3 pt-2">
								<p className="text-xs font-medium text-muted-foreground">
									System
								</p>

								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">
										Auto-Save Conversations
									</Label>
									<Switch
										checked={settings.enabledFeatures.autoSaveConversations}
										onCheckedChange={(checked) =>
											handleFeatureToggle('autoSaveConversations', checked)
										}
										className="data-[state=checked]:bg-primary"
									/>
								</div>

								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">Sound Effects</Label>
									<Switch
										checked={settings.enabledFeatures.enableSoundEffects}
										onCheckedChange={(checked) =>
											handleFeatureToggle('enableSoundEffects', checked)
										}
										className="data-[state=checked]:bg-primary"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Appearance Section (simplified) */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<Moon className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
								Appearance
							</h3>
						</div>

						<div className="space-y-4 pl-6"></div>
					</div>

					{/* Sidebar Section */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<PanelLeft className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
								Sidebar
							</h3>
						</div>

						<div className="space-y-4 pl-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label
										htmlFor="compact"
										className="text-sm font-medium text-foreground"
									>
										Compact Mode
									</Label>
									<p className="text-xs text-muted-foreground">
										Show only icons in the sidebar
									</p>
								</div>
								<Switch
									id="compact"
									checked={compactMode}
									onCheckedChange={handleCompactModeToggle}
									className="data-[state=checked]:bg-primary"
								/>
							</div>
						</div>
					</div>

					{/* Chat Section */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<MessageSquare className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
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
								<p className="text-xs text-muted-foreground mb-2">
									Long user messages will be collapsed beyond this length
								</p>
								<Select
									value={settings.messageTruncateLength.toString()}
									onValueChange={handleTruncateLengthChange}
								>
									<SelectTrigger
										id="truncate"
										className="w-full bg-sidebar/30 border-border/50"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-[#0a0d11]/95 backdrop-blur-xl border-border/50">
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
								<p className="text-xs text-muted-foreground mb-2">
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
										className="w-full bg-sidebar/30 border-border/50"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-[#0a0d11]/95 backdrop-blur-xl border-border/50">
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

					{/* Keyboard Shortcuts Section */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<Keyboard className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
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
												<kbd className="px-2 py-1 text-xs font-mono bg-sidebar border border-border rounded">
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

					{/* Reset Button */}
					<div className="flex items-center justify-between pt-2">
						<Button
							variant="destructive"
							size="sm"
							onClick={handleResetAll}
							className="gap-2"
						>
							<RotateCcw className="w-4 h-4" />
							Reset All to Defaults
						</Button>
					</div>

					{/* Info Note */}
					<div className="bg-sidebar/30 border border-border/50 rounded-lg p-4">
						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">Note:</span>{' '}
							Settings are saved locally in your browser. Cloud sync will be
							available in a future update.
						</p>
					</div>
				</div>
			</DialogContent>

			{/* Sub-modals */}
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
		</Dialog>
	)
}
