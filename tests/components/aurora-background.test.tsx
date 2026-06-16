import { AuroraBackground } from '@/components/ui/aurora-background'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('AuroraBackground', () => {
	it('uses full animation classes by default', () => {
		render(
			<AuroraBackground>
				<div data-testid="child" />
			</AuroraBackground>
		)

		expect(screen.getByTestId('child')).toBeInTheDocument()
		const effectLayer = screen.getByTestId('aurora-effect-layer')
		expect(effectLayer.className).toContain('after:animate-aurora')
		expect(effectLayer.className).toContain('filter')
	})

	it('drops heavy classes when reducedEffects is enabled', () => {
		render(
			<AuroraBackground reducedEffects>
				<div data-testid="child" />
			</AuroraBackground>
		)

		expect(screen.getByTestId('child')).toBeInTheDocument()
		const effectLayer = screen.getByTestId('aurora-effect-layer')
		expect(effectLayer.className).toContain('opacity-35')
		expect(effectLayer.className).not.toContain('after:animate-aurora')
		expect(effectLayer.className).not.toContain('filter blur-[10px]')
	})
})
