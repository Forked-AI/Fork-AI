'use client'

import { CompactColorPicker } from '@/components/ui/compact-color-picker'
import { useRef, useState } from 'react'

interface ColorButtonProps {
	label: string
	color: string
	onChange: (color: string) => void
	description?: string
}

export function ColorButton({
	label,
	color,
	onChange,
	description,
}: ColorButtonProps) {
	const [showPicker, setShowPicker] = useState(false)
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const buttonRef = useRef<HTMLButtonElement>(null)

	const handleClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect()
		const modal = document.querySelector('[role="dialog"]')
		const modalRect = modal?.getBoundingClientRect()

		if (modalRect) {
			const PICKER_WIDTH = 248
			const PICKER_HEIGHT = 340
			const PADDING = 16

			// Start position: right of button
			let x = rect.left - modalRect.left + rect.width + 10
			let y = rect.top - modalRect.top

			// Check right boundary - shift left if needed
			if (x + PICKER_WIDTH > modalRect.width - PADDING) {
				x = rect.left - modalRect.left - PICKER_WIDTH - 10 // Left of button
			}

			// Check left boundary
			if (x < PADDING) {
				x = PADDING
			}

			// Check bottom boundary - shift up if needed
			if (y + PICKER_HEIGHT > modalRect.height - PADDING) {
				y = modalRect.height - PICKER_HEIGHT - PADDING
			}

			// Check top boundary
			if (y < PADDING) {
				y = PADDING
			}

			setPosition({ x, y })
		}

		setShowPicker(true)
	}

	return (
		<>
			<button
				ref={buttonRef}
				onClick={handleClick}
				className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-[#57FCFF]/50 transition-all text-left"
			>
				<div
					className="w-10 h-10 rounded border border-white/20 shrink-0"
					style={{ backgroundColor: color }}
				/>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium">{label}</p>
					<p className="text-xs text-muted-foreground font-mono truncate">
						{color}
					</p>
					{description && (
						<p className="text-[10px] text-muted-foreground mt-0.5">
							{description}
						</p>
					)}
				</div>
			</button>

			{showPicker && (
				<CompactColorPicker
					color={color}
					onChange={onChange}
					onClose={() => setShowPicker(false)}
					position={position}
				/>
			)}
		</>
	)
}
