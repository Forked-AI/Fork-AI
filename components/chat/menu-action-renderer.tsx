'use client'

import {
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export type MenuRenderer = 'dropdown' | 'context'

interface MenuActionBase {
	key: string
	icon?: LucideIcon
	iconClassName?: string
	iconStyle?: CSSProperties
	className?: string
}

export interface MenuItemAction extends MenuActionBase {
	type: 'item'
	label: string
	onSelect: () => void | Promise<void>
	disabled?: boolean
	variant?: 'default' | 'destructive'
}

export interface MenuSeparatorAction {
	type: 'separator'
	key: string
	className?: string
}

export interface MenuSubmenuAction extends MenuActionBase {
	type: 'submenu'
	label: string
	items: MenuAction[]
	contentClassName?: string
}

export type MenuAction =
	| MenuItemAction
	| MenuSeparatorAction
	| MenuSubmenuAction

interface MenuRenderStyles {
	itemClassName: string
	destructiveItemClassName: string
	submenuContentClassName: string
	separatorClassName?: string
}

function renderMenuActionIcon(
	action: MenuItemAction | MenuSubmenuAction,
	baseClassName: string
) {
	if (!action.icon) return null

	const Icon = action.icon

	return (
		<Icon
			className={[baseClassName, action.iconClassName].filter(Boolean).join(' ')}
			style={action.iconStyle}
		/>
	)
}

export function renderMenuActions(
	renderer: MenuRenderer,
	actions: MenuAction[],
	styles: MenuRenderStyles
): ReactNode {
	return actions.map((action) => {
		if (action.type === 'separator') {
			if (renderer === 'dropdown') {
				return (
					<DropdownMenuSeparator
						key={action.key}
						className={action.className ?? styles.separatorClassName ?? 'bg-white/10'}
					/>
				)
			}

			return (
				<ContextMenuSeparator
					key={action.key}
					className={action.className ?? styles.separatorClassName ?? 'bg-white/10'}
				/>
			)
		}

		if (action.type === 'submenu') {
			const triggerContent = (
				<>
					{renderMenuActionIcon(action, 'mr-2 h-4 w-4')}
					{action.label}
				</>
			)

			if (renderer === 'dropdown') {
				return (
					<DropdownMenuSub key={action.key}>
						<DropdownMenuSubTrigger
							className={action.className ?? styles.itemClassName}
						>
							{triggerContent}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent
							className={action.contentClassName ?? styles.submenuContentClassName}
						>
							{renderMenuActions(renderer, action.items, styles)}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				)
			}

			return (
				<ContextMenuSub key={action.key}>
					<ContextMenuSubTrigger
						className={action.className ?? styles.itemClassName}
					>
						{triggerContent}
					</ContextMenuSubTrigger>
					<ContextMenuSubContent
						className={action.contentClassName ?? styles.submenuContentClassName}
					>
						{renderMenuActions(renderer, action.items, styles)}
					</ContextMenuSubContent>
				</ContextMenuSub>
			)
		}

		const itemContent = (
			<>
				{renderMenuActionIcon(action, 'mr-2 h-4 w-4')}
				{action.label}
			</>
		)
		const className =
			action.className ??
			(action.variant === 'destructive'
				? styles.destructiveItemClassName
				: styles.itemClassName)

		if (renderer === 'dropdown') {
			return (
				<DropdownMenuItem
					key={action.key}
					onSelect={() => {
						void action.onSelect()
					}}
					disabled={action.disabled}
					variant={action.variant ?? 'default'}
					className={className}
				>
					{itemContent}
				</DropdownMenuItem>
			)
		}

		return (
			<ContextMenuItem
				key={action.key}
				onSelect={() => {
					void action.onSelect()
				}}
				disabled={action.disabled}
				variant={action.variant ?? 'default'}
				className={className}
			>
				{itemContent}
			</ContextMenuItem>
		)
	})
}

export function isMenuItemAction(action: MenuAction): action is MenuItemAction {
	return action.type === 'item'
}
