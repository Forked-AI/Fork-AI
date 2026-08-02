import { ZenColorPicker } from '@/components/ui/zen-color-picker'
import { DEFAULT_THEME_COLOR_POSITIONS } from '@/lib/theme-engine'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

describe('ZenColorPicker', () => {
	it('removes and adds controlled color stops with matching positions', () => {
		const onChange = vi.fn()
		const colors = ['#57FCFF', '#9B59B6', '#2ECC71']
		const positions = DEFAULT_THEME_COLOR_POSITIONS
		const { rerender } = render(
			<ZenColorPicker
				colors={colors}
				positions={positions}
				onChange={onChange}
			/>
		)

		fireEvent.click(screen.getByTitle('Remove color'))
		expect(onChange).toHaveBeenLastCalledWith(
			colors.slice(0, 2),
			positions.slice(0, 2)
		)

		rerender(
			<ZenColorPicker
				colors={colors.slice(0, 2)}
				positions={positions.slice(0, 2)}
				onChange={onChange}
			/>
		)
		fireEvent.click(screen.getByTitle('Add color'))

		expect(onChange).toHaveBeenLastCalledWith(
			['#57FCFF', '#9B59B6', '#FFFFFF'],
			positions
		)
	})

	it('does not publish incomplete manual hex values', () => {
		const onChange = vi.fn()
		render(
			<ZenColorPicker
				colors={['#57FCFF']}
				positions={[DEFAULT_THEME_COLOR_POSITIONS[0]]}
				onChange={onChange}
			/>
		)
		const input = screen.getByLabelText('Manual Color Input')

		fireEvent.change(input, { target: { value: '#123' } })
		expect(onChange).not.toHaveBeenCalled()
		expect(screen.getByRole('alert')).toHaveTextContent('six-digit hex color')

		fireEvent.change(input, { target: { value: '#123456' } })
		expect(onChange).toHaveBeenCalledWith(
			['#123456'],
			[DEFAULT_THEME_COLOR_POSITIONS[0]]
		)
	})

	it('lets keyboard users select which stop the swatches update', () => {
		const onChange = vi.fn()
		render(
			<ZenColorPicker
				colors={['#57FCFF', '#9B59B6']}
				positions={DEFAULT_THEME_COLOR_POSITIONS.slice(0, 2)}
				onChange={onChange}
			/>
		)

		fireEvent.click(
			screen.getByRole('button', { name: 'Select theme color 2' })
		)
		fireEvent.click(screen.getByTitle('#FF6B35'))

		expect(onChange).toHaveBeenCalledWith(
			['#57FCFF', '#FF6B35'],
			DEFAULT_THEME_COLOR_POSITIONS.slice(0, 2)
		)
	})

	it('publishes persisted positions when a gradient stop is dragged', () => {
		const onChange = vi.fn()
		render(
			<ZenColorPicker
				colors={['#57FCFF', '#9B59B6']}
				positions={DEFAULT_THEME_COLOR_POSITIONS.slice(0, 2)}
				onChange={onChange}
			/>
		)
		const canvas = screen.getByTestId('theme-gradient-canvas')
		Object.defineProperty(canvas, 'getBoundingClientRect', {
			value: () => ({
				left: 0,
				top: 0,
				width: 300,
				height: 300,
				right: 300,
				bottom: 300,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}),
		})
		Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() })
		Object.defineProperty(canvas, 'releasePointerCapture', { value: vi.fn() })

		fireEvent.pointerDown(canvas, { clientX: 150, clientY: 60, pointerId: 1 })
		fireEvent.pointerMove(canvas, { clientX: 210, clientY: 90, pointerId: 1 })
		fireEvent.pointerUp(canvas, { clientX: 210, clientY: 90, pointerId: 1 })

		expect(onChange).toHaveBeenCalledWith(
			['#57FCFF', '#9B59B6'],
			expect.arrayContaining([expect.objectContaining({ x: 0.7, y: 0.3 })])
		)
	})
})
