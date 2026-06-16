import { SkillPicker } from '@/components/chat/skill-picker'
import type {
	InstalledSkillView,
	SkillCollectionView,
	SkillTemplate,
} from '@/lib/skills/catalog'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const skillMocks = vi.hoisted(() => ({
	templates: [] as SkillTemplate[],
	installedSkills: [] as InstalledSkillView[],
	collections: [] as SkillCollectionView[],
	createSkill: vi.fn(),
	updateSkill: vi.fn(),
	installSkill: vi.fn(),
	updateInstalledSkill: vi.fn(),
	deleteInstalledSkill: vi.fn(),
	upgradeInstalledSkill: vi.fn(),
	createCollection: vi.fn(),
	addSkillToCollection: vi.fn(),
	removeSkillFromCollection: vi.fn(),
	deleteCollection: vi.fn(),
	bindConversationSkill: vi.fn(),
}))

vi.mock('@/hooks/use-skills', () => ({
	useSkillTemplates: () => ({
		data: skillMocks.templates,
		isLoading: false,
	}),
	useInstalledSkills: () => ({
		data: skillMocks.installedSkills,
		isLoading: false,
	}),
	useSkillCollections: () => ({ data: skillMocks.collections }),
	useSkillActions: () => ({
		createSkill: skillMocks.createSkill,
		updateSkill: skillMocks.updateSkill,
		installSkill: skillMocks.installSkill,
		updateInstalledSkill: skillMocks.updateInstalledSkill,
		deleteInstalledSkill: skillMocks.deleteInstalledSkill,
		upgradeInstalledSkill: skillMocks.upgradeInstalledSkill,
		createCollection: skillMocks.createCollection,
		addSkillToCollection: skillMocks.addSkillToCollection,
		removeSkillFromCollection: skillMocks.removeSkillFromCollection,
		deleteCollection: skillMocks.deleteCollection,
		bindConversationSkill: skillMocks.bindConversationSkill,
	}),
	activeSkillFromInstalled: (
		installedSkill: InstalledSkillView,
		scope: 'turn' | 'conversation',
		bindingId?: string
	) => ({
		installedSkillId: installedSkill.id,
		templateId: installedSkill.templateId,
		versionId: installedSkill.versionId,
		title: installedSkill.template.title,
		scope,
		riskLevel: installedSkill.template.riskLevel,
		requiredTools: installedSkill.template.requiredTools,
		bindingId,
	}),
}))

vi.mock('@/components/ui/dialog', () => ({
	Dialog: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTrigger: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h1>{children}</h1>
	),
	DialogDescription: ({ children }: { children: React.ReactNode }) => (
		<p>{children}</p>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onSelect,
	}: {
		children: React.ReactNode
		onSelect?: () => void
	}) => <button onClick={onSelect}>{children}</button>,
	DropdownMenuSeparator: () => <hr />,
	DropdownMenuCheckboxItem: ({
		children,
		onCheckedChange,
	}: {
		children: React.ReactNode
		onCheckedChange?: () => void
	}) => <button onClick={onCheckedChange}>{children}</button>,
	DropdownMenuSub: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}))

vi.mock('@/components/ui/scroll-area', () => ({
	ScrollArea: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}))

vi.mock('@/components/ui/select', () => ({
	Select: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<button>{children}</button>
	),
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<span>{placeholder}</span>
	),
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
	AlertDialog: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	AlertDialogAction: ({
		children,
		onClick,
	}: {
		children: React.ReactNode
		onClick?: () => void
	}) => <button onClick={onClick}>{children}</button>,
	AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
		<button>{children}</button>
	),
	AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
		<p>{children}</p>
	),
	AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
}))

const template: SkillTemplate = {
	id: 'research-helper',
	versionId: 'research-helper-v1',
	versionNumber: 1,
	title: 'Research Helper',
	summary: 'Research a topic and organize the findings.',
	description: 'Research a topic and organize the findings with citations.',
	category: 'research',
	tags: ['research'],
	source: 'first_party',
	ownerId: null,
	visibility: 'public',
	status: 'listed',
	riskLevel: 'low',
	requiredTools: [],
	settings: {},
	whenToUse: 'Use when the user asks for structured research.',
	mainInstructions: 'Research the request and organize the important findings.',
	outputFormat: 'Use concise headings and bullets.',
	examples: [
		{
			userRequest: 'Research a market.',
			idealResponse: 'A concise market brief.',
		},
	],
	instructions: {
		role: 'Research assistant',
		workflow: ['Research the request', 'Organize the findings'],
		outputContract: 'Use concise headings and bullets.',
	},
}

const writingTemplate: SkillTemplate = {
	...template,
	id: 'writing-helper',
	versionId: 'writing-helper-v1',
	title: 'Writing Helper',
	summary: 'Improve and structure written content.',
	description: 'Improve and structure written content for a target audience.',
	category: 'writing',
	tags: ['writing'],
}

function installedSkill(
	overrides: Partial<InstalledSkillView> = {}
): InstalledSkillView {
	return {
		id: 'installed-research-helper',
		templateId: template.id,
		versionId: template.versionId,
		currentVersionId: template.versionId,
		alias: null,
		enabled: true,
		pinned: false,
		defaultScope: null,
		settingsJson: null,
		installedAt: '2026-06-13T00:00:00.000Z',
		lastUsedAt: null,
		disabledAt: null,
		updateAvailable: false,
		template,
		...overrides,
	}
}

function installedWritingSkill(
	overrides: Partial<InstalledSkillView> = {}
): InstalledSkillView {
	return installedSkill({
		id: 'installed-writing-helper',
		templateId: writingTemplate.id,
		versionId: writingTemplate.versionId,
		currentVersionId: writingTemplate.versionId,
		template: writingTemplate,
		...overrides,
	})
}

function renderPicker() {
	return render(
		<SkillPicker
			conversationId="conversation-1"
			activeSkills={[]}
			onActivateSkill={vi.fn()}
			onRemoveActiveSkill={vi.fn()}
		/>
	)
}

describe('SkillPicker', () => {
	beforeEach(() => {
		skillMocks.templates = [template]
		skillMocks.installedSkills = [installedSkill()]
		skillMocks.collections = []
		skillMocks.createSkill.mockReset()
		skillMocks.updateSkill.mockReset()
		skillMocks.installSkill.mockReset()
		skillMocks.updateInstalledSkill.mockReset()
		skillMocks.deleteInstalledSkill.mockReset()
		skillMocks.upgradeInstalledSkill.mockReset()
		skillMocks.createCollection.mockReset()
		skillMocks.addSkillToCollection.mockReset()
		skillMocks.removeSkillFromCollection.mockReset()
		skillMocks.deleteCollection.mockReset()
		skillMocks.bindConversationSkill.mockReset()
	})

	it('keeps blank and template-based drafts separate', async () => {
		const user = userEvent.setup()
		renderPicker()

		await user.click(screen.getByRole('tab', { name: 'Create' }))
		const nameInput = screen.getByLabelText(/^Name/)
		await user.type(nameInput, 'My independent skill')

		await user.click(screen.getByRole('tab', { name: 'Templates' }))
		await user.click(
			screen.getByRole('button', { name: 'Duplicate & customize' })
		)

		expect(
			screen.getByRole('heading', { name: 'Create from a template' })
		).toBeInTheDocument()
		expect(screen.getByLabelText(/^Name/)).toHaveValue('Research Helper copy')
		expect(
			screen.getByText(/Starting from Research Helper/)
		).toBeInTheDocument()

		await user.click(screen.getByRole('tab', { name: 'Create' }))

		expect(
			screen.getByRole('heading', { name: 'Create a skill' })
		).toBeInTheDocument()
		expect(screen.getByLabelText(/^Name/)).toHaveValue('My independent skill')
	})

	it('resets a duplicated template to a completely blank form', async () => {
		const user = userEvent.setup()
		renderPicker()

		await user.click(
			screen.getByRole('button', { name: 'Duplicate & customize' })
		)
		expect(screen.getByText('Example 1')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Reset to blank' }))

		expect(screen.getByLabelText(/^Name/)).toHaveValue('')
		expect(screen.getByLabelText(/^Description/)).toHaveValue('')
		expect(screen.getByLabelText(/^When to use/)).toHaveValue('')
		expect(screen.getByLabelText(/^Instructions/)).toHaveValue('')
		expect(screen.getByLabelText(/^Output format/)).toHaveValue('')
		expect(
			screen.queryByText(/Starting from Research Helper/)
		).not.toBeInTheDocument()
		expect(screen.queryByText('Example 1')).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Reset form' })
		).toBeInTheDocument()
	})

	it('uses one pin toggle and an explicit enablement switch', async () => {
		const user = userEvent.setup()
		skillMocks.installedSkills = [
			installedSkill(),
			installedWritingSkill({
				enabled: false,
				disabledAt: '2026-06-13T00:30:00.000Z',
			}),
		]
		const { rerender } = renderPicker()

		await user.click(screen.getByRole('tab', { name: 'My Library' }))
		expect(
			screen
				.getAllByRole('heading', { level: 3 })
				.map((heading) => heading.textContent)
		).toEqual(['Research Helper', 'Writing Helper'])
		expect(screen.queryByText('Enabled')).not.toBeInTheDocument()

		const enablementSwitch = screen.getByRole('switch', {
			name: 'Disable Research Helper',
		})
		expect(enablementSwitch).toBeChecked()
		await user.hover(enablementSwitch)
		expect(await screen.findByRole('tooltip')).toHaveTextContent(
			'Disable Research Helper'
		)
		await user.unhover(enablementSwitch)

		const pinButton = screen.getByRole('button', {
			name: 'Pin Research Helper',
		})
		expect(pinButton).toHaveAttribute('aria-pressed', 'false')
		await user.click(pinButton)
		expect(skillMocks.updateInstalledSkill).toHaveBeenCalledWith(
			'installed-research-helper',
			{ pinned: true }
		)

		await user.click(enablementSwitch)
		expect(skillMocks.updateInstalledSkill).toHaveBeenCalledWith(
			'installed-research-helper',
			{ enabled: false }
		)

		skillMocks.installedSkills = [
			installedSkill({
				enabled: false,
				disabledAt: '2026-06-13T01:00:00.000Z',
			}),
			installedWritingSkill({
				enabled: false,
				disabledAt: '2026-06-13T00:30:00.000Z',
			}),
		]
		rerender(
			<SkillPicker
				conversationId="conversation-1"
				activeSkills={[]}
				onActivateSkill={vi.fn()}
				onRemoveActiveSkill={vi.fn()}
			/>
		)

		expect(
			screen
				.getAllByRole('heading', { level: 3 })
				.map((heading) => heading.textContent)
		).toEqual(['Research Helper', 'Writing Helper'])
		expect(
			screen.getByRole('switch', { name: 'Enable Research Helper' })
		).not.toBeChecked()
		for (const addButton of screen.getAllByRole('button', {
			name: 'Add Research Helper to chat',
		})) {
			expect(addButton).toBeDisabled()
		}
		await user.click(
			screen.getByRole('switch', { name: 'Enable Research Helper' })
		)
		expect(skillMocks.updateInstalledSkill).toHaveBeenCalledWith(
			'installed-research-helper',
			{ enabled: true }
		)
	})

	it('renames skills and manages collection membership from the library', async () => {
		const user = userEvent.setup()
		skillMocks.collections = [
			{
				id: 'collection-research',
				name: 'Research set',
				description: null,
				isDefault: false,
				createdAt: '2026-06-14T00:00:00.000Z',
				updatedAt: '2026-06-14T00:00:00.000Z',
				items: [],
			},
		]
		renderPicker()

		await user.click(screen.getByRole('tab', { name: 'My Library' }))
		await user.click(screen.getByRole('button', { name: 'Rename in library' }))
		const aliasInput = screen.getByLabelText('Library name')
		await user.clear(aliasInput)
		await user.type(aliasInput, 'Deep Research')
		await user.click(screen.getByRole('button', { name: 'Save' }))

		await waitFor(() => {
			expect(skillMocks.updateInstalledSkill).toHaveBeenCalledWith(
				'installed-research-helper',
				{ alias: 'Deep Research' }
			)
		})

		await user.click(screen.getByRole('button', { name: 'Research set' }))
		await waitFor(() => {
			expect(skillMocks.addSkillToCollection).toHaveBeenCalledWith(
				'collection-research',
				'installed-research-helper'
			)
		})
	})

	it('creates collections and exposes an explicit version update action', async () => {
		const user = userEvent.setup()
		skillMocks.installedSkills = [
			installedSkill({
				updateAvailable: true,
				currentVersionId: 'research-helper-v2',
			}),
		]
		skillMocks.upgradeInstalledSkill.mockResolvedValue(
			installedSkill({
				versionId: 'research-helper-v2',
				currentVersionId: 'research-helper-v2',
			})
		)
		renderPicker()

		await user.click(screen.getByRole('tab', { name: 'My Library' }))
		await user.click(screen.getByRole('button', { name: 'New collection' }))
		await user.type(screen.getByLabelText('Name'), 'Favorites')
		await user.click(screen.getByRole('button', { name: 'Create' }))
		await waitFor(() => {
			expect(skillMocks.createCollection).toHaveBeenCalledWith('Favorites')
		})

		await user.click(screen.getByRole('button', { name: 'Update to latest' }))
		await waitFor(() => {
			expect(skillMocks.upgradeInstalledSkill).toHaveBeenCalledWith(
				'installed-research-helper'
			)
		})
	})

	it('edits an owned skill by creating and installing a new version', async () => {
		const user = userEvent.setup()
		const ownedTemplate: SkillTemplate = {
			...template,
			id: 'owned-template',
			versionId: 'owned-template-v1',
			title: 'Owned Skill',
			source: 'user',
			ownerId: 'user-1',
			visibility: 'private',
			status: 'draft',
		}
		const ownedInstall = installedSkill({
			id: 'installed-owned-template',
			templateId: ownedTemplate.id,
			versionId: ownedTemplate.versionId,
			currentVersionId: ownedTemplate.versionId,
			template: ownedTemplate,
		})
		const updatedTemplate = {
			...ownedTemplate,
			versionId: 'owned-template-v2',
			versionNumber: 2,
		}
		skillMocks.templates = [ownedTemplate]
		skillMocks.installedSkills = [ownedInstall]
		skillMocks.updateSkill.mockResolvedValue(updatedTemplate)
		skillMocks.upgradeInstalledSkill.mockResolvedValue(
			installedSkill({
				...ownedInstall,
				versionId: updatedTemplate.versionId,
				currentVersionId: updatedTemplate.versionId,
				template: updatedTemplate,
			})
		)
		renderPicker()

		await user.click(screen.getByRole('tab', { name: 'My Library' }))
		await user.click(screen.getByRole('button', { name: 'Edit skill' }))
		expect(
			screen.getByRole('heading', { name: 'Edit skill' })
		).toBeInTheDocument()
		await user.clear(screen.getByLabelText(/^Description/))
		await user.type(
			screen.getByLabelText(/^Description/),
			'An updated description for the owned private skill.'
		)
		await user.click(screen.getByRole('button', { name: 'Save new version' }))

		await waitFor(() => {
			expect(skillMocks.updateSkill).toHaveBeenCalledWith(
				'owned-template',
				expect.objectContaining({
					description: 'An updated description for the owned private skill.',
				})
			)
			expect(skillMocks.upgradeInstalledSkill).toHaveBeenCalledWith(
				'installed-owned-template'
			)
		})
	})

	it('clears the submitted blank draft after creating a skill', async () => {
		const user = userEvent.setup()
		const createdTemplate = {
			...template,
			id: 'custom-skill',
			versionId: 'custom-skill-v1',
			title: 'My Custom Skill',
			source: 'user' as const,
			ownerId: 'user-1',
			visibility: 'private' as const,
			status: 'draft' as const,
		}
		const createdInstall = installedSkill({
			id: 'installed-custom-skill',
			templateId: createdTemplate.id,
			versionId: createdTemplate.versionId,
			currentVersionId: createdTemplate.versionId,
			template: createdTemplate,
		})
		skillMocks.createSkill.mockResolvedValue(createdTemplate)
		skillMocks.installSkill.mockResolvedValue(createdInstall)
		skillMocks.bindConversationSkill.mockResolvedValue({ id: 'binding-1' })
		renderPicker()

		await user.click(screen.getByRole('tab', { name: 'Create' }))
		await user.type(screen.getByLabelText(/^Name/), 'My Custom Skill')
		await user.type(
			screen.getByLabelText(/^Description/),
			'Creates a useful structured response.'
		)
		await user.type(
			screen.getByLabelText(/^When to use/),
			'Use this for requests that need a structured response.'
		)
		await user.type(
			screen.getByLabelText(/^Instructions/),
			'Analyze the request and produce a clear structured answer.'
		)
		await user.click(screen.getByRole('button', { name: 'Save private skill' }))

		await waitFor(() => {
			expect(skillMocks.createSkill).toHaveBeenCalledTimes(1)
		})
		expect(screen.getByRole('tab', { name: 'My Library' })).toHaveAttribute(
			'data-state',
			'active'
		)

		await user.click(screen.getByRole('tab', { name: 'Create' }))
		expect(screen.getByLabelText(/^Name/)).toHaveValue('')
		expect(screen.getByLabelText(/^Description/)).toHaveValue('')
	})
})
