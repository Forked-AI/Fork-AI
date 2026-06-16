'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

/**
 * Full-page fixed SVG canvas with diagonal energy paths that shift on scroll.
 * Inspired by taiko.xyz's flowing SVG path lines.
 * This is rendered as a fixed overlay behind all content.
 */
export function ScrollCanvas() {
	const svgRef = useRef<SVGSVGElement>(null)

	useGSAP(() => {
		const mm = gsap.matchMedia()

		mm.add('(min-width: 768px)', () => {
			// Paths drift on scroll at different rates for depth
			gsap.to('.sc-path-slow', {
				attr: { transform: 'translate(0, -80)' },
				ease: 'none',
				scrollTrigger: {
					trigger: 'body',
					start: 'top top',
					end: 'bottom top',
					scrub: 2,
				},
			})

			gsap.to('.sc-path-medium', {
				attr: { transform: 'translate(0, -160)' },
				ease: 'none',
				scrollTrigger: {
					trigger: 'body',
					start: 'top top',
					end: 'bottom top',
					scrub: 1.5,
				},
			})

			gsap.to('.sc-path-fast', {
				attr: { transform: 'translate(30, -240)' },
				ease: 'none',
				scrollTrigger: {
					trigger: 'body',
					start: 'top top',
					end: 'bottom top',
					scrub: 1,
				},
			})
		})

		return () => mm.revert()
	}, { scope: svgRef })

	return (
		<svg
			ref={svgRef}
			className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<defs>
				<linearGradient id="pathGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="rgba(203,213,225,0)" />
					<stop offset="40%" stopColor="rgba(203,213,225,0.12)" />
					<stop offset="100%" stopColor="rgba(203,213,225,0)" />
				</linearGradient>
				<linearGradient id="pathGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="rgba(148,163,184,0)" />
					<stop offset="50%" stopColor="rgba(148,163,184,0.08)" />
					<stop offset="100%" stopColor="rgba(148,163,184,0)" />
				</linearGradient>
				<linearGradient id="pathGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="rgba(100,116,139,0)" />
					<stop offset="50%" stopColor="rgba(100,116,139,0.06)" />
					<stop offset="100%" stopColor="rgba(100,116,139,0)" />
				</linearGradient>
			</defs>

			{/* Slow layer — large sweeping diagonal */}
			<g className="sc-path-slow">
				<path
					d="M -200 400 Q 400 -100 1200 600 T 2400 200"
					stroke="url(#pathGrad1)"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M -100 800 Q 500 300 1400 900 T 2600 500"
					stroke="url(#pathGrad1)"
					strokeWidth="1"
					fill="none"
				/>
			</g>

			{/* Medium layer — crossing paths */}
			<g className="sc-path-medium">
				<path
					d="M 1800 -200 Q 900 400 -100 1000 T -800 1800"
					stroke="url(#pathGrad2)"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M 1600 100 Q 800 700 -300 1200"
					stroke="url(#pathGrad2)"
					strokeWidth="0.8"
					fill="none"
				/>
			</g>

			{/* Fast layer — tighter curves */}
			<g className="sc-path-fast">
				<path
					d="M 300 -300 Q 900 200 700 800 T 500 1600"
					stroke="url(#pathGrad3)"
					strokeWidth="1"
					fill="none"
				/>
				<path
					d="M 900 -200 Q 500 400 1100 900"
					stroke="url(#pathGrad3)"
					strokeWidth="0.6"
					fill="none"
				/>
			</g>
		</svg>
	)
}
