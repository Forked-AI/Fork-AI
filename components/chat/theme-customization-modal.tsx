'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import { Button } from '@/components/ui/button'
import { ContrastChip, ContrastWarning } from '@/components/ui/contrast-chip'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
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
import { AlertTriangle, Palette } from 'lucide-react'
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
	const [showPresets, setShowPresets] = useState(true)
	const [contrastDismissed, setContrastDismissed] = useState(false)
	const { resolvedTheme } = useTheme()
	const effectiveTheme =
		resolveEffectiveTheme(settings.theme, resolvedTheme) ?? 'dark'
	const resolvedPalette = useMemo(
		() => resolveThemePalette(settings, effectiveTheme),
		[effectiveTheme, settings]
	)

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
		<ChatModalShell
			open={open}
			onOpenChange={onOpenChange}
			title="Palette Customization"
			description="Customize palette colors, gradients, and visual effects"
			icon={<Palette className="h-5 w-5 text-primary" />}
			backAction={() => onOpenChange(false)}
			headerTrailing={<ContrastChip report={contrastReport} />}
			contentClassName="sm:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden"
		>
			<div className="space-y-6">
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
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">WCAG AA Compliant</p>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{COMPLIANT_PRESETS.map((preset) => (
										<button
											key={preset.id}
											onClick={() => handlePresetSelect(preset)}
											className={cn(
												'rounded-lg border p-3 text-left transition-all hover:shadow-lg',
												settings.activePreset === preset.id
													? 'border-primary bg-primary/10 ring-2 ring-primary/20'
													: 'border-border/50 hover:border-primary/50'
											)}
										>
											<div className="mb-1.5 flex items-center gap-1.5">
												<div
													className="h-6 w-6 rounded-md border border-white/20"
													style={{
														background:
															preset.chatBackground || preset.background,
													}}
													title="Background"
												/>
												<div
													className="h-5 w-5 rounded-full border border-white/20"
													style={{ backgroundColor: preset.primary }}
													title="Primary"
												/>
												<div
													className="h-4 w-4 rounded-full border border-white/20"
													style={{ backgroundColor: preset.secondary }}
													title="Secondary"
												/>
											</div>
											<p className="text-xs font-medium">{preset.name}</p>
											<p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
												{preset.description}
											</p>
										</button>
									))}
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<p className="text-xs text-muted-foreground">
										Artistic (may not meet AA)
									</p>
									<AlertTriangle className="h-3 w-3 text-yellow-500" />
								</div>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{ARTISTIC_PRESETS.map((preset) => (
										<button
											key={preset.id}
											onClick={() => handlePresetSelect(preset)}
											className={cn(
												'rounded-lg border p-3 text-left transition-all hover:shadow-lg',
												settings.activePreset === preset.id
													? 'border-primary bg-primary/10 ring-2 ring-primary/20'
													: 'border-border/50 hover:border-primary/50'
											)}
										>
											<div className="mb-1.5 flex items-center gap-1.5">
												<div
													className="h-6 w-6 rounded-md border border-white/20"
													style={{
														background:
															preset.chatBackground || preset.background,
													}}
													title="Background"
												/>
												<div
													className="h-5 w-5 rounded-full border border-white/20"
													style={{ backgroundColor: preset.primary }}
													title="Primary"
												/>
												<div
													className="h-4 w-4 rounded-full border border-white/20"
													style={{ backgroundColor: preset.secondary }}
													title="Secondary"
												/>
											</div>
											<p className="text-xs font-medium">{preset.name}</p>
											<p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
												{preset.description}
											</p>
										</button>
									))}
								</div>
							</div>
						</>
					)}
				</div>

				<div className="space-y-3 border-t border-border/50 pt-2">
					<div className="space-y-2">
						<Label className="text-sm font-medium">Custom Palette Colors</Label>
						<p className="text-xs text-muted-foreground">
							Pick 1-3 colors to create your theme. Background, buttons, and UI
							elements will use these colors.
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

				{!contrastDismissed &&
					contrastReport.overall === 'fail' &&
					!settings.strictContrastMode && (
						<ContrastWarning
							report={contrastReport}
							onAutoFix={handleContrastAutoFix}
							onDismiss={() => setContrastDismissed(true)}
						/>
					)}

				<div className="space-y-3 border-t border-border/50 pt-2">
					<Label className="text-sm font-medium">Advanced Options</Label>

					<div className="space-y-3">
						<Field
							orientation="horizontal"
							className="items-start justify-between gap-4 rounded-lg border border-border/40 bg-sidebar/20 px-3 py-2.5"
						>
							<FieldContent className="gap-0.5">
								<FieldLabel className="w-auto text-sm font-medium">
									Strict Contrast Mode
								</FieldLabel>
								<FieldDescription className="text-xs text-muted-foreground">
									Block saving themes below AA standard
								</FieldDescription>
							</FieldContent>
							<Switch
								checked={settings.strictContrastMode}
								onCheckedChange={(checked) => {
									updateSettings({ strictContrastMode: checked })
								}}
								className="mt-0.5 data-[state=checked]:bg-primary"
							/>
						</Field>

						<Field
							orientation="horizontal"
							className="items-start justify-between gap-4 rounded-lg border border-border/40 bg-sidebar/20 px-3 py-2.5"
						>
							<FieldContent className="gap-0.5">
								<FieldLabel className="w-auto text-sm font-medium">
									Reduced Effects
								</FieldLabel>
								<FieldDescription className="text-xs text-muted-foreground">
									Disable wave/noise for better performance
								</FieldDescription>
							</FieldContent>
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
								className="mt-0.5 data-[state=checked]:bg-primary"
							/>
						</Field>
					</div>
				</div>

				<div className="rounded-lg border border-border/50 bg-sidebar/30 p-3">
					<p className="text-xs text-muted-foreground">
						<span className="font-semibold text-foreground">Tip:</span> Use the
						preset themes as a starting point, then customize colors to match
						your preferences. All compliant presets meet WCAG AA standards.
					</p>
				</div>
			</div>
		</ChatModalShell>
	)
}
