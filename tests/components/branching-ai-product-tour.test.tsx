import {
	AudienceRolesWidget,
	BranchingIntroComparisonWidget,
	BranchingQuizWidget,
	ForkGeneratorWidget,
	ModelIntegrationsWidget,
	PrivacySharingWidget,
} from '@/components/branching-ai-chat-motion'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => {
	const ignoredProps = new Set([
		'animate',
		'exit',
		'initial',
		'layout',
		'transition',
		'variants',
		'viewport',
		'whileInView',
	])
	const motion = new Proxy(
		{},
		{
			get: (_target, tag: string) => {
				const MotionComponent = React.forwardRef<
					HTMLElement,
					Record<string, unknown>
				>(({ children, ...props }, ref) =>
					React.createElement(
						tag,
						{
							...Object.fromEntries(
								Object.entries(props).filter(([key]) => !ignoredProps.has(key))
							),
							ref,
						},
						children as React.ReactNode
					)
				)
				MotionComponent.displayName = `MotionMock(${tag})`
				return MotionComponent
			},
		}
	)

	return {
		motion,
		useReducedMotion: () => true,
	}
})

describe('branching AI independent widgets', () => {
	it('renders all six widgets without shared tour step props', () => {
		render(
			React.createElement(
				React.Fragment,
				null,
				React.createElement(BranchingIntroComparisonWidget),
				React.createElement(ForkGeneratorWidget),
				React.createElement(ModelIntegrationsWidget),
				React.createElement(PrivacySharingWidget),
				React.createElement(AudienceRolesWidget),
				React.createElement(BranchingQuizWidget)
			)
		)

		expect(screen.getByText('Workflow comparison')).toBeInTheDocument()
		expect(screen.getByText('Live fork generator')).toBeInTheDocument()
		expect(screen.getByText('Model integrations')).toBeInTheDocument()
		expect(screen.getByText('Privacy and sharing')).toBeInTheDocument()
		expect(screen.getByText("Who it's for")).toBeInTheDocument()
		expect(screen.getByText('Quick check')).toBeInTheDocument()
		expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument()
		expect(
			screen.queryByLabelText('Product tour progress')
		).not.toBeInTheDocument()
	})

	it('starts with one root node and spawns forked branch nodes', async () => {
		const user = userEvent.setup()

		render(React.createElement(ForkGeneratorWidget))

		expect(screen.getByText('Root prompt')).toBeVisible()
		expect(screen.queryByText(/Map onboarding risks:/)).not.toBeInTheDocument()

		const input = screen.getByPlaceholderText('Type an idea to fork')
		await user.clear(input)
		await user.type(input, 'Map onboarding risks')
		await user.click(screen.getByRole('button', { name: /generate fork/i }))

		expect(
			screen.getByText('Map onboarding risks: practical path')
		).toBeVisible()
		expect(screen.getByText('Map onboarding risks: bold path')).toBeVisible()
		expect(
			screen.getByText('Map onboarding risks: validation path')
		).toBeVisible()
	})

	it('regenerates the fork graph with new branch labels', async () => {
		const user = userEvent.setup()

		render(React.createElement(ForkGeneratorWidget))

		const input = screen.getByPlaceholderText('Type an idea to fork')
		await user.clear(input)
		await user.type(input, 'Map onboarding risks')
		await user.click(screen.getByRole('button', { name: /generate fork/i }))
		expect(screen.getByText('Map onboarding risks: bold path')).toBeVisible()

		await user.clear(input)
		await user.type(input, 'Compare vendor options')
		await user.click(screen.getByRole('button', { name: /generate fork/i }))

		expect(
			screen.queryByText('Map onboarding risks: bold path')
		).not.toBeInTheDocument()
		expect(screen.getByText('Compare vendor options: bold path')).toBeVisible()
	})

	it('reveals unique model integration content when cards are selected', async () => {
		const user = userEvent.setup()

		render(React.createElement(ModelIntegrationsWidget))

		await user.click(screen.getByRole('button', { name: /Claude/i }))
		expect(screen.getAllByText('Long-form reasoning')).toHaveLength(2)
		expect(screen.getByText('Careful branch critique')).toBeVisible()
		expect(
			screen.getByText(/produce a careful critique of the same branch/i)
		).toBeVisible()

		await user.click(screen.getByRole('button', { name: /ChatGPT/i }))
		expect(screen.getAllByText('Fast iteration')).toHaveLength(2)
		expect(screen.getByText('Rapid branch draft')).toBeVisible()
		expect(
			screen.getByText(/Draft several implementation paths quickly/i)
		).toBeVisible()
	})

	it('toggles the privacy widget between full and restricted views', async () => {
		const user = userEvent.setup()

		render(React.createElement(PrivacySharingWidget))

		const restricted = screen.getByRole('button', {
			name: 'After: restricted share',
		})
		expect(restricted).toHaveAttribute('aria-pressed', 'true')

		const full = screen.getByRole('button', { name: 'Before: full view' })
		await user.click(full)

		expect(full).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByText('System prompt notes')).toBeVisible()
		expect(screen.getByText('Private notes hidden')).toBeVisible()
	})

	it('switches role tabs in the audience widget', async () => {
		const user = userEvent.setup()

		render(React.createElement(AudienceRolesWidget))

		await user.click(screen.getByRole('button', { name: 'Researchers' }))

		expect(screen.getByText('Highlighted workflow')).toBeVisible()
		expect(
			screen.getByText('Track competing hypotheses side by side')
		).toBeVisible()
		expect(
			screen.getByText(/Summarize evidence for collaborators/i)
		).toBeVisible()
	})

	it('shows wrong and correct quiz feedback', async () => {
		const user = userEvent.setup()

		render(React.createElement(BranchingQuizWidget))

		await user.click(
			screen.getByRole('button', {
				name: /Restart the conversation for every new direction/i,
			})
		)
		expect(screen.getByText(/Not quite/i)).toBeVisible()

		await user.click(
			screen.getByRole('button', {
				name: /Branch from the same context and compare paths/i,
			})
		)
		expect(screen.getByText(/Correct/i)).toBeVisible()
		expect(screen.getByText(/keeps the source context intact/i)).toBeVisible()
		expect(screen.getByText(/Why this matters/i)).toBeVisible()
	})
})
