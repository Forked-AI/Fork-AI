'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({
	className,
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				'peer group inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 bg-black/20 dark:bg-white/20 aria-checked:bg-primary aria-checked:dark:bg-primary',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={
					'pointer-events-none block size-4 rounded-full ring-0 shadow-sm transition-transform bg-background dark:bg-foreground group-aria-checked:dark:bg-primary-foreground translate-x-0 group-aria-checked:translate-x-[calc(100%-2px)]'
				}
			/>
		</SwitchPrimitive.Root>
	)
}

export { Switch }
