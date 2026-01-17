'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/hooks/use-settings'
import { Check, Keyboard, Moon, PanelLeft, Settings as SettingsIcon } from 'lucide-react'
import { useState } from 'react'

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
	const { settings, updateSettings } = useSettings()
	const [showSaved, setShowSaved] = useState(false)

	const handleCompactModeToggle = (checked: boolean) => {
		onCompactModeChange(checked)
		updateSettings({ compactMode: checked })
		showSavedIndicator()
	}

	const showSavedIndicator = () => {
		setShowSaved(true)
		setTimeout(() => setShowSaved(false), 2000)
	}

	const keyboardShortcuts = [
		{ keys: ['Cmd', 'B'], description: 'Toggle sidebar' },
		{ keys: ['Cmd', '/'], description: 'Open settings' },
		{ keys: ['Esc'], description: 'Close modal' },
		{ keys: ['Cmd', 'K'], description: 'Command palette (coming soon)' },
	]

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/80 backdrop-blur-xl border border-[#57FCFF]/20 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-foreground flex items-center gap-2">
						<SettingsIcon className="w-5 h-5 text-[#57FCFF]" />
						Preferences
					</DialogTitle>
					<DialogDescription className="text-muted-foreground flex items-center gap-2">
						Customize your Fork AI experience
						{showSaved && (
							<span className="inline-flex items-center gap-1 text-xs text-[#57FCFF]">
								<Check className="w-3 h-3" />
								Saved locally
							</span>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Appearance Section */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b border-border/50">
							<Moon className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
								Appearance
							</h3>
						</div>
						
						<div className="space-y-4 pl-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="theme" className="text-sm font-medium text-foreground">
										Dark Mode
									</Label>
									<p className="text-xs text-muted-foreground">
										Currently active (light mode coming soon)
									</p>
								</div>
								<Switch
									id="theme"
									checked={true}
									disabled
									className="data-[state=checked]:bg-[#57FCFF]"
								/>
							</div>
						</div>
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
									<Label htmlFor="compact" className="text-sm font-medium text-foreground">
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
									className="data-[state=checked]:bg-[#57FCFF]"
								/>
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
									<span className="text-muted-foreground">{shortcut.description}</span>
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

					{/* Info Note */}
					<div className="bg-sidebar/30 border border-border/50 rounded-lg p-4">
						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">Note:</span>{' '}
							Settings are saved locally in your browser. Cloud sync will be available in a future update.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
