import { ChatTOC } from '@/components/chat/ChatTOC'
import type { Message } from '@/hooks/use-chat'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', async () => {
	const React = await import('react')

	const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
		({ children, ...props }, ref) => {
			const motionProps = props as Record<string, unknown>
			delete motionProps.initial
			delete motionProps.animate
			delete motionProps.exit
			delete motionProps.transition
			delete motionProps.layout

			return (
				<div ref={ref} {...motionProps}>
					{children}
				</div>
			)
		}
	)
	MotionDiv.displayName = 'MotionDiv'

	const MotionButton = React.forwardRef<
		HTMLButtonElement,
		React.ButtonHTMLAttributes<HTMLButtonElement>
	>(({ children, ...props }, ref) => {
		const motionProps = props as Record<string, unknown>
		delete motionProps.initial
		delete motionProps.animate
		delete motionProps.exit
		delete motionProps.transition
		delete motionProps.layoutId

		return (
			<button ref={ref} {...motionProps}>
				{children}
			</button>
		)
	})
	MotionButton.displayName = 'MotionButton'

	return {
		AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		motion: {
			div: MotionDiv,
			button: MotionButton,
		},
	}
})

vi.mock('@/components/ui/checkbox', () => ({
	Checkbox: ({ checked, onCheckedChange, onClick, className }: any) => (
		<input
			type="checkbox"
			checked={Boolean(checked)}
			onChange={() => onCheckedChange?.(!checked)}
			onClick={onClick}
			className={className}
		/>
	),
}))

vi.mock('@/components/ui/scroll-area', () => ({
	ScrollArea: ({ children, className }: any) => (
		<div className={className}>{children}</div>
	),
}))

vi.mock('@/components/ui/sheet', () => ({
	Sheet: ({ children }: any) => <div>{children}</div>,
	SheetContent: () => null,
	SheetHeader: ({ children }: any) => <div>{children}</div>,
	SheetTitle: ({ children }: any) => <div>{children}</div>,
	SheetTrigger: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/components/ui/tooltip', () => ({
	Tooltip: ({ children }: any) => <>{children}</>,
	TooltipContent: () => null,
	TooltipProvider: ({ children }: any) => <>{children}</>,
	TooltipTrigger: ({ children }: any) => <>{children}</>,
}))

function createMessages(assistantContent: string): Message[] {
	return [
		{
			id: 'user-1',
			role: 'user',
			content: 'User prompt',
			createdAt: new Date('2026-04-16T11:49:00.000Z'),
		},
		{
			id: 'assistant-1',
			role: 'assistant',
			content: assistantContent,
			model: 'gpt-5',
			createdAt: new Date('2026-04-16T11:49:30.000Z'),
		},
	]
}

describe('ChatTOC', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it('collapses shortly after pointer leave', () => {
		render(
			<ChatTOC
				messages={createMessages('Assistant preview')}
				onScrollToMessage={vi.fn()}
				selectedMessageIds={new Set()}
				onToggleSelection={vi.fn()}
				onSelectAll={vi.fn()}
				onDeselectAll={vi.fn()}
				activeMessageId={null}
				isStreaming={false}
			/>
		)

		const desktopToc = screen.getByTestId('chat-toc-desktop')
		expect(screen.queryByText('Select all')).not.toBeInTheDocument()

		act(() => {
			fireEvent.pointerEnter(desktopToc)
		})
		expect(screen.getByText('Select all')).toBeInTheDocument()

		act(() => {
			fireEvent.pointerLeave(desktopToc)
			vi.advanceTimersByTime(120)
		})
		expect(screen.getByText('Select all')).toBeInTheDocument()

		act(() => {
			vi.advanceTimersByTime(80)
		})
		expect(screen.queryByText('Select all')).not.toBeInTheDocument()
	})

	it('collapses immediately on window blur while expanded', () => {
		render(
			<ChatTOC
				messages={createMessages('Assistant preview')}
				onScrollToMessage={vi.fn()}
				selectedMessageIds={new Set()}
				onToggleSelection={vi.fn()}
				onSelectAll={vi.fn()}
				onDeselectAll={vi.fn()}
				activeMessageId={null}
				isStreaming={false}
			/>
		)

		const desktopToc = screen.getByTestId('chat-toc-desktop')

		act(() => {
			fireEvent.pointerEnter(desktopToc)
		})
		expect(screen.getByText('Select all')).toBeInTheDocument()

		act(() => {
			window.dispatchEvent(new Event('blur'))
		})
		expect(screen.queryByText('Select all')).not.toBeInTheDocument()
	})

	it('keeps previews frozen while streaming and refreshes after stream completion', () => {
		const sharedProps = {
			onScrollToMessage: vi.fn(),
			selectedMessageIds: new Set<string>(),
			onToggleSelection: vi.fn(),
			onSelectAll: vi.fn(),
			onDeselectAll: vi.fn(),
			activeMessageId: null,
		}

		const { rerender } = render(
			<ChatTOC
				{...sharedProps}
				messages={createMessages('First preview')}
				isStreaming={true}
			/>
		)

		const desktopToc = screen.getByTestId('chat-toc-desktop')
		act(() => {
			fireEvent.pointerEnter(desktopToc)
		})

		expect(screen.getByText('First preview')).toBeInTheDocument()

		rerender(
			<ChatTOC
				{...sharedProps}
				messages={createMessages('Second preview')}
				isStreaming={true}
			/>
		)

		expect(screen.getByText('First preview')).toBeInTheDocument()
		expect(screen.queryByText('Second preview')).not.toBeInTheDocument()

		rerender(
			<ChatTOC
				{...sharedProps}
				messages={createMessages('Second preview')}
				isStreaming={false}
			/>
		)

		expect(screen.getByText('Second preview')).toBeInTheDocument()
	})
})
