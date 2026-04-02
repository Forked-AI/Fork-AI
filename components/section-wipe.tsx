'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

interface SectionWipeProps {
	/** Must be unique across all wipes on the page */
	id: string
	/** Gradient colors for the wipe curtain */
	fromColor?: string
	toColor?: string
}

/**
 * A scroll-triggered gradient curtain that wipes vertically when
 * the preceding section is about to leave the viewport.
 * Inspired by taiko.xyz's gradient wave wipe transitions.
 */
export function SectionWipe({ id, fromColor = 'rgba(15,15,20,0.95)', toColor = 'rgba(5,5,10,0)' }: SectionWipeProps) {
	const curtainRef = useRef<HTMLDivElement>(null)

	useGSAP(() => {
		const curtain = curtainRef.current
		if (!curtain) return

		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: curtain,
				start: 'top 90%',
				end: 'bottom 20%',
				scrub: 0.8,
			},
		})

		tl
			.fromTo(
				curtain,
				{ scaleY: 0, transformOrigin: 'top center', opacity: 1 },
				{ scaleY: 1, duration: 0.5, ease: 'power2.inOut' }
			)
			.to(
				curtain,
				{ scaleY: 0, transformOrigin: 'bottom center', opacity: 0, duration: 0.5, ease: 'power2.inOut' },
				'>'
			)
	}, { scope: curtainRef })

	return (
		<div
			ref={curtainRef}
			id={id}
			className="relative z-30 h-32 overflow-hidden"
			aria-hidden="true"
		>
			<div
				className="absolute inset-0"
				style={{
					background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
				}}
			/>
		</div>
	)
}
