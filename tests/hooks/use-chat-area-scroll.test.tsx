import { useChatAreaScroll } from '@/components/chat/chat-area/use-chat-area-scroll'
import type { Message } from '@/hooks/use-chat'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function createMessage(id: string): Message {
	return {
		id,
		role: 'assistant',
		content: `message-${id}`,
		createdAt: new Date('2026-04-13T00:00:00.000Z'),
	}
}

function setScrollMetrics(
	element: HTMLElement,
	{
		scrollHeight,
		clientHeight,
		scrollTop,
	}: {
		scrollHeight: number
		clientHeight: number
		scrollTop: number
	}
) {
	Object.defineProperty(element, 'scrollHeight', {
		configurable: true,
		value: scrollHeight,
	})
	Object.defineProperty(element, 'clientHeight', {
		configurable: true,
		value: clientHeight,
	})
	Object.defineProperty(element, 'scrollTop', {
		configurable: true,
		value: scrollTop,
		writable: true,
	})
}

function ScrollHarness({ messages }: { messages: Message[] }) {
	const {
		messagesContainerRef,
		messagesEndRef,
		showScrollButton,
	} = useChatAreaScroll(messages)

	return (
		<div>
			<div ref={messagesContainerRef} data-testid="container">
				<div style={{ height: '2000px' }}>content</div>
				<div ref={messagesEndRef} data-testid="end" />
			</div>
			<span data-testid="scroll-state">
				{showScrollButton ? 'show' : 'hide'}
			</span>
		</div>
	)
}

function installAsyncRafMock() {
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		return window.setTimeout(() => callback(0), 0) as unknown as number
	})
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
		window.clearTimeout(frameId)
	})
}

describe('useChatAreaScroll', () => {
	let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView

	beforeEach(() => {
		originalScrollIntoView = HTMLElement.prototype.scrollIntoView
		HTMLElement.prototype.scrollIntoView = vi.fn()
	})

	afterEach(() => {
		HTMLElement.prototype.scrollIntoView = originalScrollIntoView
		vi.restoreAllMocks()
	})

	it('toggles the scroll button based on near-bottom state', async () => {
		installAsyncRafMock()

		const { getByTestId } = render(
			<ScrollHarness messages={[createMessage('1')]} />
		)
		const container = getByTestId('container')
		const state = getByTestId('scroll-state')

		setScrollMetrics(container, {
			scrollHeight: 1200,
			clientHeight: 600,
			scrollTop: 0,
		})
		fireEvent.scroll(container)

		await waitFor(() => {
			expect(state.textContent).toBe('show')
		})

		setScrollMetrics(container, {
			scrollHeight: 1200,
			clientHeight: 600,
			scrollTop: 540,
		})
		fireEvent.scroll(container)

		await waitFor(() => {
			expect(state.textContent).toBe('hide')
		})
	})

	it('auto-scrolls when message count increases and user is near bottom', async () => {
		installAsyncRafMock()

		const scrollIntoViewMock = vi.mocked(HTMLElement.prototype.scrollIntoView)
		const { getByTestId, rerender } = render(
			<ScrollHarness messages={[createMessage('1')]} />
		)
		const container = getByTestId('container')

		setScrollMetrics(container, {
			scrollHeight: 1200,
			clientHeight: 600,
			scrollTop: 540,
		})
		fireEvent.scroll(container)

		scrollIntoViewMock.mockClear()
		rerender(<ScrollHarness messages={[createMessage('1'), createMessage('2')]} />)

		await waitFor(() => {
			expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' })
		})
	})

	it('does not auto-scroll on new messages when user is reading older content', async () => {
		installAsyncRafMock()

		const scrollIntoViewMock = vi.mocked(HTMLElement.prototype.scrollIntoView)
		const { getByTestId, rerender } = render(
			<ScrollHarness messages={[createMessage('1')]} />
		)
		const container = getByTestId('container')
		const state = getByTestId('scroll-state')

		setScrollMetrics(container, {
			scrollHeight: 1200,
			clientHeight: 600,
			scrollTop: 0,
		})
		fireEvent.scroll(container)

		await waitFor(() => {
			expect(state.textContent).toBe('show')
		})

		scrollIntoViewMock.mockClear()
		rerender(<ScrollHarness messages={[createMessage('1'), createMessage('2')]} />)

		await waitFor(() => {
			expect(scrollIntoViewMock).not.toHaveBeenCalled()
		})
	})

	it('throttles rapid scroll events to one animation frame', () => {
		const frameCallbacks: FrameRequestCallback[] = []
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			frameCallbacks.push(callback)
			return frameCallbacks.length
		})
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

		const { getByTestId } = render(
			<ScrollHarness messages={[createMessage('1')]} />
		)
		const container = getByTestId('container')

		setScrollMetrics(container, {
			scrollHeight: 1200,
			clientHeight: 600,
			scrollTop: 0,
		})

		fireEvent.scroll(container)
		fireEvent.scroll(container)
		expect(frameCallbacks).toHaveLength(1)

		act(() => {
			frameCallbacks[0]?.(0)
		})

		fireEvent.scroll(container)
		expect(frameCallbacks).toHaveLength(2)
	})

	it('attaches a single scroll listener across message rerenders', () => {
		installAsyncRafMock()

		const { getByTestId, rerender, unmount } = render(
			<ScrollHarness messages={[createMessage('1')]} />
		)
		const container = getByTestId('container')
		const addEventListenerSpy = vi.spyOn(container, 'addEventListener')
		const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener')

		rerender(<ScrollHarness messages={[createMessage('1'), createMessage('2')]} />)
		rerender(
			<ScrollHarness
				messages={[createMessage('1'), createMessage('2'), createMessage('3')]}
			/>
		)

		expect(addEventListenerSpy).not.toHaveBeenCalled()

		unmount()
		expect(removeEventListenerSpy).toHaveBeenCalledTimes(1)
		expect(removeEventListenerSpy.mock.calls[0]?.[0]).toBe('scroll')
	})
})
