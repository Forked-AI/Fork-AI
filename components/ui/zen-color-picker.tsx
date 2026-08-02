'use client'

import { Button } from '@/components/ui/button'
import { CompactColorPicker } from '@/components/ui/compact-color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { generateGradient, type ColorStop } from '@/lib/color-utils'
import {
	createPerformanceMonitor,
	type PerformanceMetrics,
} from '@/lib/performance-monitor'
import {
	DEFAULT_THEME_COLOR_POSITIONS,
	type ThemeColorPosition,
} from '@/lib/theme-engine'
import { QUICK_SWATCHES } from '@/lib/theme-presets'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface DotPosition {
	x: number // 0-1 normalized
	y: number // 0-1 normalized
}

interface ColorDot {
	id: string
	color: string
	position: DotPosition
	active: boolean
}

interface ZenColorPickerProps {
	colors: string[] // 1-3 colors
	positions: ThemeColorPosition[]
	onChange: (
		colors: string[],
		positions: ThemeColorPosition[]
	) => boolean | void
	waveIntensity?: number
	noiseAmount?: number
	onWaveChange?: (intensity: number) => void
	onNoiseChange?: (amount: number) => void
	className?: string
}

const CANVAS_SIZE = 300
const CANVAS_SIZE_MOBILE = 280
const DOT_SIZE = 24
const DOT_SIZE_MOBILE = 32

export function ZenColorPicker({
	colors,
	positions,
	onChange,
	waveIntensity = 0,
	noiseAmount = 0,
	onWaveChange,
	onNoiseChange,
	className,
}: ZenColorPickerProps) {
	const canvasRef = useRef<HTMLDivElement>(null)
	const [isMobile, setIsMobile] = useState(false)
	const [dots, setDots] = useState<ColorDot[]>([])
	const dotsRef = useRef<ColorDot[]>([])
	const [isDragging, setIsDragging] = useState(false)
	const [draggedDotIndex, setDraggedDotIndex] = useState<number | null>(null)
	const [dragStartPos, setDragStartPos] = useState<{
		x: number
		y: number
	} | null>(null)
	const [swatchScrollPosition, setSwatchScrollPosition] = useState(0)
	const [showColorPicker, setShowColorPicker] = useState(false)
	const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 })
	const [editingDotId, setEditingDotId] = useState<string | null>(null)
	const swatchContainerRef = useRef<HTMLDivElement>(null)

	// Performance monitor without toast dependency
	const performanceMonitorRef = useRef(
		createPerformanceMonitor({
			onLowPerformance: (metrics: PerformanceMetrics) => {
				// Performance warning will be handled by parent component
				console.warn(`Low performance detected: ${metrics.averageFps} FPS`)
			},
			threshold: 30,
		})
	)

	const canvasSize = isMobile ? CANVAS_SIZE_MOBILE : CANVAS_SIZE
	const dotSize = isMobile ? DOT_SIZE_MOBILE : DOT_SIZE
	const restoreControlledDots = useCallback(() => {
		const activeId = dotsRef.current.find((dot) => dot.active)?.id || 'dot-0'
		const restoredDots = colors.map((color, index) => {
			const id = `dot-${index}`

			return {
				id,
				color,
				position: positions[index] || DEFAULT_THEME_COLOR_POSITIONS[index],
				active: id === activeId,
			}
		})

		if (!restoredDots.some((dot) => dot.active) && restoredDots[0]) {
			restoredDots[0].active = true
		}

		setDots(restoredDots)
		dotsRef.current = restoredDots
	}, [colors, positions])

	// Check if mobile
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 640)
		}
		checkMobile()
		window.addEventListener('resize', checkMobile)
		return () => window.removeEventListener('resize', checkMobile)
	}, [])

	// Synchronize the controlled color stops after a preset, reset, or reload.
	useEffect(() => {
		restoreControlledDots()
	}, [restoreControlledDots])

	// Calculate mirror and companion positions
	const calculateLinkedPositions = useCallback(
		(dotAPosition: DotPosition): { dotB: DotPosition; dotC: DotPosition } => {
			const centerX = 0.5
			const centerY = 0.5

			// Dot B: Mirror of A (180° opposite)
			const dotB: DotPosition = {
				x: centerX + (centerX - dotAPosition.x),
				y: centerY + (centerY - dotAPosition.y),
			}

			// Dot C: 120° clockwise from A
			const dx = dotAPosition.x - centerX
			const dy = dotAPosition.y - centerY
			const angleA = Math.atan2(dy, dx)
			const angleC = angleA + (2 * Math.PI) / 3
			const radius = Math.sqrt(dx * dx + dy * dy)

			const dotC: DotPosition = {
				x: centerX + radius * Math.cos(angleC),
				y: centerY + radius * Math.sin(angleC),
			}

			const clamp = (value: number) => Math.max(0.05, Math.min(0.95, value))

			return {
				dotB: { x: clamp(dotB.x), y: clamp(dotB.y) },
				dotC: { x: clamp(dotC.x), y: clamp(dotC.y) },
			}
		},
		[]
	)

	// Handle dot drag
	// Mouse/touch handlers
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!canvasRef.current || dots.length === 0) return

			const rect = canvasRef.current.getBoundingClientRect()
			const x = (e.clientX - rect.left) / rect.width
			const y = (e.clientY - rect.top) / rect.height

			// Check if clicking on ANY dot (closest first)
			for (let i = 0; i < dots.length; i++) {
				const dot = dots[i]
				const distance = Math.sqrt(
					Math.pow(x - dot.position.x, 2) + Math.pow(y - dot.position.y, 2)
				)

				if (distance < 0.08) {
					setDragStartPos({ x: e.clientX, y: e.clientY })
					setDraggedDotIndex(i)
					setIsDragging(true)
					performanceMonitorRef.current.start()
					e.currentTarget.setPointerCapture(e.pointerId)
					return
				}
			}
		},
		[dots]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (isDragging && draggedDotIndex !== null && canvasRef.current) {
				const rect = canvasRef.current.getBoundingClientRect()
				const x = Math.max(
					0.05,
					Math.min(0.95, (e.clientX - rect.left) / rect.width)
				)
				const y = Math.max(
					0.05,
					Math.min(0.95, (e.clientY - rect.top) / rect.height)
				)

				const newPosition = { x, y }
				const newDots = [...dots]

				if (draggedDotIndex === 0) {
					// Dragging Dot A - B and C follow via linked triangle
					const linked = calculateLinkedPositions(newPosition)
					newDots[0] = { ...newDots[0], position: newPosition }
					if (newDots[1]) newDots[1] = { ...newDots[1], position: linked.dotB }
					if (newDots[2]) newDots[2] = { ...newDots[2], position: linked.dotC }
				} else if (draggedDotIndex === 1 && dots.length >= 2) {
					// Dragging Dot B - derive A as mirror, C follows triangle
					const centerX = 0.5
					const centerY = 0.5
					const newA = {
						x: centerX - (newPosition.x - centerX),
						y: centerY - (newPosition.y - centerY),
					}
					const linked = calculateLinkedPositions(newA)
					newDots[0] = { ...newDots[0], position: newA }
					newDots[1] = { ...newDots[1], position: newPosition }
					if (newDots[2]) newDots[2] = { ...newDots[2], position: linked.dotC }
				} else if (draggedDotIndex === 2 && dots.length >= 3) {
					// Dragging Dot C - derive A from angle offset, B follows triangle
					const centerX = 0.5
					const centerY = 0.5
					const dx = newPosition.x - centerX
					const dy = newPosition.y - centerY
					const angleC = Math.atan2(dy, dx)
					const angleA = angleC - (2 * Math.PI) / 3
					const radius = Math.sqrt(dx * dx + dy * dy)
					const newA = {
						x: centerX + radius * Math.cos(angleA),
						y: centerY + radius * Math.sin(angleA),
					}
					const linked = calculateLinkedPositions(newA)
					newDots[0] = { ...newDots[0], position: newA }
					newDots[1] = { ...newDots[1], position: linked.dotB }
					newDots[2] = { ...newDots[2], position: newPosition }
				}

				setDots(newDots)
				dotsRef.current = newDots

				// Redraw gradient in real-time
				if (canvasRef.current) {
					const colorStops: ColorStop[] = newDots.map((dot) => ({
						color: dot.color,
						position: dot.position,
					}))
					canvasRef.current.style.background = generateGradient(
						colorStops,
						canvasSize,
						canvasSize
					)
				}
			}
		},
		[isDragging, draggedDotIndex, dots, calculateLinkedPositions, canvasSize]
	)

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (isDragging && draggedDotIndex !== null) {
				// Detect click vs drag: if mouse barely moved, it's a click
				const CLICK_THRESHOLD = 5
				const wasClick = dragStartPos
					? Math.abs(e.clientX - dragStartPos.x) < CLICK_THRESHOLD &&
						Math.abs(e.clientY - dragStartPos.y) < CLICK_THRESHOLD
					: false

				if (wasClick) {
					// Open color picker for the clicked dot
					const dotId = dotsRef.current[draggedDotIndex]?.id
					if (dotId) {
						const activeDots = dotsRef.current.map((dot) => ({
							...dot,
							active: dot.id === dotId,
						}))
						setDots(activeDots)
						dotsRef.current = activeDots

						const modalContent = canvasRef.current?.closest('[role="dialog"]')
						const modalRect = modalContent?.getBoundingClientRect()

						if (modalRect) {
							const PICKER_WIDTH = 248
							const PICKER_HEIGHT = 340
							const PADDING = 16

							let x = e.clientX - modalRect.left + 20
							let y = e.clientY - modalRect.top

							if (x + PICKER_WIDTH > modalRect.width - PADDING) {
								x = e.clientX - modalRect.left - PICKER_WIDTH - 20
							}
							if (x < PADDING) x = PADDING
							if (y + PICKER_HEIGHT > modalRect.height - PADDING) {
								y = modalRect.height - PICKER_HEIGHT - PADDING
							}
							if (y < PADDING) y = PADDING

							setPickerPosition({ x, y })
							setEditingDotId(dotId)
							setShowColorPicker(true)
						}
					}
				} else {
					const currentDots = dotsRef.current
					const applied = onChange(
						currentDots.map((dot) => dot.color),
						currentDots.map((dot) => dot.position)
					)
					if (applied === false) {
						restoreControlledDots()
					}
				}

				setIsDragging(false)
				setDraggedDotIndex(null)
				setDragStartPos(null)
				performanceMonitorRef.current.stop()
				e.currentTarget.releasePointerCapture(e.pointerId)
			}
		},
		[isDragging, draggedDotIndex, dragStartPos, onChange, restoreControlledDots]
	)

	// Add/remove color stops
	const handleAddColor = () => {
		if (colors.length >= 3) return
		onChange(
			[...colors, '#FFFFFF'],
			[...positions, DEFAULT_THEME_COLOR_POSITIONS[colors.length]]
		)
	}

	const handleRemoveColor = () => {
		if (colors.length <= 1) return
		onChange(colors.slice(0, -1), positions.slice(0, -1))
	}

	// Update active dot color
	const handleColorChange = (color: string) => {
		const activeDotIndex = dots.findIndex((dot) => dot.active)
		if (activeDotIndex === -1) return

		const newColors = [...colors]
		newColors[activeDotIndex] = color
		onChange(
			newColors,
			dotsRef.current.map((dot) => dot.position)
		)
	}

	// Handle color change from CompactColorPicker
	const handleColorPickerChange = (color: string) => {
		if (!editingDotId) return

		const newDots = dots.map((dot) =>
			dot.id === editingDotId ? { ...dot, color } : dot
		)
		const applied = onChange(
			newDots.map((dot) => dot.color),
			newDots.map((dot) => dot.position)
		)
		if (applied === false) {
			restoreControlledDots()
			return
		}
		setDots(newDots)
		dotsRef.current = newDots

		// Redraw gradient
		if (canvasRef.current) {
			const colorStops: ColorStop[] = newDots.map((dot) => ({
				color: dot.color,
				position: dot.position,
			}))
			canvasRef.current.style.background = generateGradient(
				colorStops,
				canvasSize,
				canvasSize
			)
		}
	}

	// Close color picker
	const handleColorPickerClose = () => {
		setShowColorPicker(false)
		setEditingDotId(null)
	}

	// Generate gradient background
	const getGradientStyle = (): React.CSSProperties => {
		const colorStops: ColorStop[] = dots.map((dot) => ({
			color: dot.color,
			position: dot.position,
		}))

		const gradient = generateGradient(colorStops, canvasSize, canvasSize)

		const style: React.CSSProperties = {
			background: gradient,
		}

		// Apply wave filter if intensity > 0
		if (waveIntensity > 0) {
			style.filter = `url(#wave-filter)`
		}

		return style
	}

	// Swatch scrolling
	const handleSwatchScroll = (direction: 'left' | 'right') => {
		if (!swatchContainerRef.current) return
		const scrollAmount = 120
		const newPosition =
			direction === 'left'
				? swatchScrollPosition - scrollAmount
				: swatchScrollPosition + scrollAmount
		swatchContainerRef.current.scrollLeft = newPosition
		setSwatchScrollPosition(newPosition)
	}

	const activeDot = dots.find((dot) => dot.active)
	const activeDotColor = activeDot?.color || '#FFFFFF'
	const [manualColor, setManualColor] = useState(activeDotColor)

	useEffect(() => {
		setManualColor(activeDotColor)
	}, [activeDotColor])

	return (
		<div className={cn('space-y-4', className)}>
			{/* Canvas */}
			<div className="flex items-center justify-center">
				<div
					ref={canvasRef}
					data-testid="theme-gradient-canvas"
					className="relative rounded-lg overflow-hidden cursor-crosshair border border-white/10"
					style={{
						width: canvasSize,
						height: canvasSize,
						touchAction: 'none',
					}}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
				>
					{/* Gradient background */}
					<div className="absolute inset-0" style={getGradientStyle()} />

					{/* Noise overlay */}
					{noiseAmount > 0 && (
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								opacity: noiseAmount / 100,
								backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' /%3E%3C/svg%3E")`,
							}}
						/>
					)}

					{/* Dots */}
					{dots.map((dot, index) => (
						<button
							type="button"
							key={dot.id}
							data-dot-id={dot.id}
							aria-label={`Select theme color ${index + 1}`}
							aria-pressed={dot.active}
							onClick={() => {
								const activeDots = dotsRef.current.map((item) => ({
									...item,
									active: item.id === dot.id,
								}))
								setDots(activeDots)
								dotsRef.current = activeDots
							}}
							className={cn(
								'absolute rounded-full transition-transform',
								isDragging && draggedDotIndex === index
									? 'cursor-grabbing scale-125 z-20'
									: 'cursor-grab hover:scale-110 z-10',
								dot.active && !isDragging && 'scale-110'
							)}
							style={{
								width: dotSize,
								height: dotSize,
								backgroundColor: dot.color,
								left: `${dot.position.x * 100}%`,
								top: `${dot.position.y * 100}%`,
								transform: 'translate(-50%, -50%)',
								// High-contrast ring: white + black outline always visible
								border: dot.active
									? '3px solid white'
									: '2px solid rgba(255,255,255,0.9)',
								boxShadow: dot.active
									? '0 0 0 2px rgba(0,0,0,0.6), 0 0 0 6px rgba(87,252,255,0.35), 0 4px 12px rgba(0,0,0,0.4)'
									: '0 0 0 1.5px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
							}}
							title={`Drag to move · Click to change color ${index + 1}`}
						/>
					))}
				</div>
			</div>

			{/* Color swatches + add/remove */}
			<div className="flex items-center gap-2">
				<button
					onClick={() => handleSwatchScroll('left')}
					className="shrink-0 p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-30"
					disabled={swatchScrollPosition <= 0}
				>
					<ChevronLeft className="size-4" />
				</button>

				<div
					ref={swatchContainerRef}
					className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1"
					style={{ scrollBehavior: 'smooth' }}
				>
					{QUICK_SWATCHES.map((color) => (
						<button
							key={color}
							onClick={() => handleColorChange(color)}
							className={cn(
								'shrink-0 size-8 rounded-full transition-all',
								activeDotColor === color
									? 'ring-2 ring-white/50 ring-offset-2 ring-offset-[#0a0d11]'
									: 'hover:ring-1 hover:ring-white/30'
							)}
							style={{ backgroundColor: color }}
							title={color}
						/>
					))}
				</div>

				<button
					onClick={() => handleSwatchScroll('right')}
					className="shrink-0 p-1 hover:bg-white/5 rounded transition-colors"
				>
					<ChevronRight className="size-4" />
				</button>

				<div className="flex items-center gap-1 shrink-0">
					<Button
						size="icon-sm"
						variant="outline"
						onClick={handleAddColor}
						disabled={colors.length >= 3}
						title="Add color"
					>
						<Plus className="size-4" />
					</Button>
					<Button
						size="icon-sm"
						variant="outline"
						onClick={handleRemoveColor}
						disabled={colors.length <= 1}
						title="Remove color"
					>
						<Minus className="size-4" />
					</Button>
				</div>
			</div>

			{/* Wave slider */}
			{onWaveChange && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-sm">Wave</Label>
						<span className="text-xs text-muted-foreground">
							{waveIntensity}%
						</span>
					</div>
					<Slider
						value={[waveIntensity]}
						onValueChange={([value]) => onWaveChange(value)}
						min={0}
						max={100}
						step={5}
						className="w-full"
					/>
				</div>
			)}

			{/* Noise dial (using slider for now) */}
			{onNoiseChange && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-sm">Noise</Label>
						<span className="text-xs text-muted-foreground">
							{noiseAmount}%
						</span>
					</div>
					<Slider
						value={[noiseAmount]}
						onValueChange={([value]) => onNoiseChange(value)}
						min={0}
						max={100}
						step={5}
						className="w-full"
					/>
				</div>
			)}

			{/* Manual color input */}
			<div className="space-y-2">
				<Label htmlFor="manual-color" className="text-sm">
					Manual Color Input
				</Label>
				<Input
					id="manual-color"
					type="text"
					value={manualColor}
					onChange={(e) => {
						const value = e.target.value
						setManualColor(value)
						if (/^#[0-9a-fA-F]{6}$/.test(value)) {
							handleColorChange(value)
						}
					}}
					aria-invalid={!/^#[0-9a-fA-F]{6}$/.test(manualColor)}
					placeholder="#FFFFFF"
					maxLength={7}
					className="font-mono"
				/>
				{!/^#[0-9a-fA-F]{6}$/.test(manualColor) && (
					<p className="text-xs text-destructive" role="alert">
						Enter a complete six-digit hex color.
					</p>
				)}
			</div>

			{/* SVG filter for wave effect */}
			{waveIntensity > 0 && (
				<svg style={{ position: 'absolute', width: 0, height: 0 }}>
					<defs>
						<filter id="wave-filter">
							<feTurbulence
								type="fractalNoise"
								baseFrequency={0.01 * (waveIntensity / 100)}
								numOctaves="3"
								result="noise"
							/>
							<feDisplacementMap
								in="SourceGraphic"
								in2="noise"
								scale={20 * (waveIntensity / 100)}
								xChannelSelector="R"
								yChannelSelector="G"
							/>
						</filter>
					</defs>
				</svg>
			)}

			{/* Compact Color Picker Popup */}
			{showColorPicker && editingDotId && (
				<CompactColorPicker
					color={dots.find((d) => d.id === editingDotId)?.color || '#FFFFFF'}
					onChange={handleColorPickerChange}
					onClose={handleColorPickerClose}
					position={pickerPosition}
				/>
			)}
		</div>
	)
}
