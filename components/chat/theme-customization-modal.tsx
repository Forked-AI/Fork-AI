'use client'

import { Button } from '@/components/ui/button'
import { ContrastChip, ContrastWarning } from '@/components/ui/contrast-chip'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ZenColorPicker } from '@/components/ui/zen-color-picker'
import { type Settings } from '@/hooks/use-settings'
import {
	suggestContrastFix,
	validateThemeContrast,
} from '@/lib/color-utils'
import {
	buildCustomThemeFromColors,
	getThemeSettingsFromPreset,
	resolveEffectiveTheme,
	resolveThemePalette,
} from '@/lib/theme-engine'
import {
	ARTISTIC_PRESETS,
	COMPLIANT_PRESETS,
	type ThemePreset,
} from '@/lib/theme-presets'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowLeft, Palette } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'

interface ThemeCustomizationModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	settings: Settings
	updateSettings: (settings: Partial<Settings>) => void
	showSavedIndicator?: () => void
}

export function ThemeCustomizationModal({
	open,
	onOpenChange,
	settings,
	updateSettings,
}: ThemeCustomizationModalProps) {
	// const { settings, updateSettings } = useSettings() // Using props instead
	const [showPresets, setShowPresets] = useState(true)
	const [contrastDismissed, setContrastDismissed] = useState(false)
	const { resolvedTheme } = useTheme()
	const effectiveTheme =
		resolveEffectiveTheme(settings.theme, resolvedTheme) ?? 'dark'
	const resolvedPalette = useMemo(
		() => resolveThemePalette(settings, effectiveTheme),
		[effectiveTheme, settings]
	)

	// Calculate contrast report
	const contrastReport = useMemo(() => {
		return validateThemeContrast(
			resolvedPalette.themeText,
			resolvedPalette.themeBackground,
			resolvedPalette.themePrimary,
			resolvedPalette.themeCard
		)
	}, [resolvedPalette])

	const handleThemeColorsChange = (colors: string[]) => {
		updateSettings(buildCustomThemeFromColors(colors))
		setContrastDismissed(false)
	}

	const handlePresetSelect = (preset: ThemePreset) => {
		updateSettings(getThemeSettingsFromPreset(preset))
		setContrastDismissed(false)
	}

	const handleWaveChange = (intensity: number) => {
		updateSettings({ waveIntensity: intensity })
	}

	const handleNoiseChange = (amount: number) => {
		updateSettings({ noiseAmount: amount })
	}

	const handleContrastAutoFix = () => {
		const fixedColor = suggestContrastFix(
			resolvedPalette.themePrimary || '#57FCFF',
			resolvedPalette.themeBackground || '#0d1117',
			4.5
		)
		updateSettings(
			buildCustomThemeFromColors([
				fixedColor,
				settings.themeSecondary || fixedColor,
				settings.themeTertiary || fixedColor,
			])
		)
		setContrastDismissed(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-popover border border-primary/20 sm:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
				<DialogHeader>
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-center gap-2 flex-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenChange(false)}
								className="h-8 w-8 p-0 hover:bg-primary/10"
							>
								<ArrowLeft className="w-4 h-4" />
							</Button>
							<div>
								<DialogTitle className="text-foreground flex items-center gap-2">
									<Palette className="w-5 h-5 text-primary" />
									Palette Customization
								</DialogTitle>
								<DialogDescription className="text-muted-foreground text-sm mt-1">
									Customize palette colors, gradients, and visual effects
								</DialogDescription>
							</div>
						</div>
						<div className="flex-shrink-0 pt-1">
							<ContrastChip report={contrastReport} />
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Preset Palettes */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-sm font-medium">Preset Palettes</Label>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setShowPresets(!showPresets)}
								className="text-xs"
							>
								{showPresets ? 'Hide' : 'Show'}
							</Button>
						</div>

						{showPresets && (
							<>
								{/* WCAG Compliant Presets */}
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground">
										WCAG AA Compliant
									</p>
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
										{COMPLIANT_PRESETS.map((preset) => (
											<button
												key={preset.id}
												onClick={() => handlePresetSelect(preset)}
												className={cn(
													'p-3 rounded-lg border transition-all text-left hover:shadow-lg',
													settings.activePreset === preset.id
													? 'border-primary bg-primary/10 ring-2 ring-primary/20'
													: 'border-border/50 hover:border-primary/50'
												)}
											>
												<div className="flex items-center gap-1.5 mb-1.5">
													{/* Show theme colors: background, primary, secondary */}
													<div
														className="w-6 h-6 rounded-md border border-white/20"
														style={{
															background:
																preset.chatBackground || preset.background,
														}}
														title="Background"
													/>
													<div
														className="w-5 h-5 rounded-full border border-white/20"
														style={{ backgroundColor: preset.primary }}
														title="Primary"
													/>
													<div
														className="w-4 h-4 rounded-full border border-white/20"
														style={{ backgroundColor: preset.secondary }}
														title="Secondary"
													/>
												</div>
												<p className="text-xs font-medium">{preset.name}</p>
												<p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
													{preset.description}
												</p>
											</button>
										))}
									</div>
								</div>

								{/* Artistic Presets */}
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<p className="text-xs text-muted-foreground">
											Artistic (may not meet AA)
										</p>
										<AlertTriangle className="w-3 h-3 text-yellow-500" />
									</div>
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
										{ARTISTIC_PRESETS.map((preset) => (
											<button
												key={preset.id}
												onClick={() => handlePresetSelect(preset)}
												className={cn(
													'p-3 rounded-lg border transition-all text-left hover:shadow-lg',
													settings.activePreset === preset.id
													? 'border-primary bg-primary/10 ring-2 ring-primary/20'
													: 'border-border/50 hover:border-primary/50'
												)}
											>
												<div className="flex items-center gap-1.5 mb-1.5">
													{/* Show theme colors: background, primary, secondary */}
													<div
														className="w-6 h-6 rounded-md border border-white/20"
														style={{
															background:
																preset.chatBackground || preset.background,
														}}
														title="Background"
													/>
													<div
														className="w-5 h-5 rounded-full border border-white/20"
														style={{ backgroundColor: preset.primary }}
														title="Primary"
													/>
													<div
														className="w-4 h-4 rounded-full border border-white/20"
														style={{ backgroundColor: preset.secondary }}
														title="Secondary"
													/>
												</div>
												<p className="text-xs font-medium">{preset.name}</p>
												<p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
													{preset.description}
												</p>
											</button>
										))}
									</div>
								</div>
							</>
						)}
					</div>

					{/* Custom Palette Colors */}
					<div className="space-y-3 pt-2 border-t border-border/50">
						<div className="space-y-2">
							<Label className="text-sm font-medium">Custom Palette Colors</Label>
							<p className="text-xs text-muted-foreground">
								Pick 1-3 colors to create your theme. Background, buttons, and
								UI elements will use these colors.
							</p>
							<p className="text-xs text-muted-foreground">
								Card, sidebar, border, and text colors auto-adjust for optimal
								contrast.
							</p>
						</div>
						<ZenColorPicker
							colors={[
								settings.themePrimary,
								settings.themeSecondary,
								settings.themeTertiary,
							]}
							onChange={handleThemeColorsChange}
							waveIntensity={settings.waveIntensity}
							noiseAmount={settings.noiseAmount}
							onWaveChange={handleWaveChange}
							onNoiseChange={handleNoiseChange}
						/>
					</div>

					{/* Contrast warning */}
					{!contrastDismissed &&
						contrastReport.overall === 'fail' &&
						!settings.strictContrastMode && (
							<ContrastWarning
								report={contrastReport}
								onAutoFix={handleContrastAutoFix}
								onDismiss={() => setContrastDismissed(true)}
							/>
						)}

					{/* Advanced Options */}
					<div className="space-y-3 pt-2 border-t border-border/50">
						<Label className="text-sm font-medium">Advanced Options</Label>

						<div className="space-y-3">
							{/* Strict mode toggle */}
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-sm font-medium">
										Strict Contrast Mode
									</Label>
									<p className="text-xs text-muted-foreground">
										Block saving themes below AA standard
									</p>
								</div>
								<Switch
									checked={settings.strictContrastMode}
									onCheckedChange={(checked) => {
										updateSettings({ strictContrastMode: checked })
									}}
										className="data-[state=checked]:bg-primary"
								/>
							</div>

							{/* Reduced effects toggle */}
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-sm font-medium">Reduced Effects</Label>
									<p className="text-xs text-muted-foreground">
										Disable wave/noise for better performance
									</p>
								</div>
								<Switch
									checked={settings.reducedEffects}
									onCheckedChange={(checked) => {
										updateSettings(
											checked
												? {
														reducedEffects: true,
														waveIntensity: 0,
														noiseAmount: 0,
													}
												: { reducedEffects: false }
										)
									}}
										className="data-[state=checked]:bg-primary"
								/>
							</div>
						</div>
					</div>

					{/* Info Note */}
					<div className="bg-sidebar/30 border border-border/50 rounded-lg p-3">
						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">Tip:</span> Use
							the preset themes as a starting point, then customize colors to
							match your preferences. All compliant presets meet WCAG AA
							standards.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
