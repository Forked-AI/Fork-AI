'use client'

import type React from 'react'

import { cn } from '@/lib/utils'

interface AuroraBackgroundProps {
	className?: string
	children?: React.ReactNode
	showRadialGradient?: boolean
}

export const AuroraBackground = ({
	className,
	children,
	showRadialGradient = true,
}: AuroraBackgroundProps) => {
	return (
		<div
			className={cn(
				'relative flex flex-col h-full w-full overflow-hidden',
				className
			)}
		>
			<div className="absolute inset-0 overflow-hidden">
				<div
					className={cn(
						`
            [--white-gradient:repeating-linear-gradient(100deg,#ffffff_0%,#ffffff_7%,transparent_10%,transparent_12%,#ffffff_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,#000000_0%,#000000_7%,transparent_10%,transparent_12%,#000000_16%)]
            [--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)]
            [background-image:var(--white-gradient),var(--aurora)]
            dark:[background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            filter blur-[10px] invert dark:invert-0
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] 
            after:dark:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%] 
            after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-50 will-change-transform`,

						showRadialGradient &&
							`[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]`
					)}
				></div>
			</div>
			{children}
		</div>
	)
}
