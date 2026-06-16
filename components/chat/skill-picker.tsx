'use client'

import { Badge } from '@/components/ui/badge'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import {
	activeSkillFromInstalled,
	type ActiveChatSkill,
	useSkillCollections,
	useInstalledSkills,
	useSkillActions,
	useSkillTemplates,
} from '@/hooks/use-skills'
import type {
	CreateSkillTemplateInput,
	InstalledSkillView,
	SkillCollectionView,
	SkillTemplate,
} from '@/lib/skills/catalog'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
	Check,
	Library,
	Plus,
	Search,
	Wand2,
	Blocks,
	Puzzle,
	Download,
	Plug,
	Pin,
	PinOff,
	Trash2,
	Copy,
	FolderPlus,
	MoreVertical,
	Pencil,
	RefreshCw,
	RotateCcw,
	Save,
	Settings2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

interface SkillPickerProps {
	conversationId: string | null
	activeSkills: ActiveChatSkill[]
	onActivateSkill: (_skill: ActiveChatSkill) => void
	onRemoveActiveSkill?: (_installedSkillId: string) => void
}

function SkillCard({
	template,
	installedSkill,
	isActive,
	onAddToChat,
	onRemoveFromChat,
	onPin,
	onToggleEnabled,
	onDelete,
	onUseAsStartingPoint,
	onEdit,
	onRename,
	onUpgrade,
	collections,
	onToggleCollection,
	isBusy,
}: {
	template: SkillTemplate
	installedSkill?: InstalledSkillView
	isActive: boolean
	onAddToChat: () => void
	onRemoveFromChat?: () => void
	onPin?: () => void
	onToggleEnabled?: () => void
	onDelete?: () => void
	onUseAsStartingPoint: () => void
	onEdit?: () => void
	onRename?: () => void
	onUpgrade?: () => void
	collections: SkillCollectionView[]
	onToggleCollection?: (_collectionId: string, _included: boolean) => void
	isBusy: boolean
}) {
	const skillTitle = installedSkill?.alias ?? template.title
	const activationLabel = isActive
		? `Remove ${skillTitle} from chat`
		: installedSkill
			? `Add ${skillTitle} to chat`
			: `Install and add ${skillTitle} to chat`
	const enabledActionLabel = installedSkill
		? `${installedSkill.enabled ? 'Disable' : 'Enable'} ${skillTitle}`
		: ''

	return (
		<div className="group relative flex flex-col overflow-hidden rounded-lg border border-white/5 bg-[#2A2A2D] p-5 transition-all duration-200 hover:border-white/10 hover:bg-[#2F2F32]">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1 space-y-1">
					<div className="flex items-center justify-between">
						<h3 className="text-base font-semibold tracking-tight text-foreground/90 transition-colors group-hover:text-white">
							{skillTitle}
						</h3>
						<div className="flex items-center gap-1">
							{installedSkill ? (
								<Tooltip>
									<TooltipTrigger asChild>
										<Switch
											checked={installedSkill.enabled}
											onCheckedChange={onToggleEnabled}
											disabled={isBusy}
											aria-label={enabledActionLabel}
											className="mx-1"
										/>
									</TooltipTrigger>
									<TooltipContent side="top">
										{enabledActionLabel}
									</TooltipContent>
								</Tooltip>
							) : null}
							{installedSkill ? (
								<Button
									type="button"
									size="icon"
									variant="ghost"
									className={cn(
										'h-8 w-8 rounded-md text-muted-foreground',
										installedSkill.pinned && 'text-primary'
									)}
									onClick={onPin}
									disabled={isBusy}
									aria-label={
										installedSkill.pinned
											? `Unpin ${skillTitle}`
											: `Pin ${skillTitle}`
									}
									aria-pressed={installedSkill.pinned}
									title={installedSkill.pinned ? 'Unpin skill' : 'Pin skill'}
								>
									{installedSkill.pinned ? (
										<PinOff className="h-4 w-4" />
									) : (
										<Pin className="h-4 w-4" />
									)}
								</Button>
							) : null}
							<Button
								type="button"
								size="icon"
								variant="ghost"
								onClick={isActive ? onRemoveFromChat : onAddToChat}
								className={cn(
									'h-8 w-8 rounded-md text-muted-foreground',
									isActive && 'text-primary'
								)}
								disabled={isBusy || installedSkill?.enabled === false}
								aria-label={activationLabel}
								title={activationLabel}
							>
								{isActive ? (
									<Check className="h-4 w-4" />
								) : installedSkill ? (
									<Plus className="h-4 w-4" />
								) : (
									<Download className="h-4 w-4" />
								)}
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										className="h-8 w-8 rounded-md text-muted-foreground"
										disabled={isBusy}
										aria-label={`More actions for ${skillTitle}`}
									>
										<MoreVertical className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-52 border-white/10 bg-popover"
								>
									<DropdownMenuItem onSelect={onUseAsStartingPoint}>
										<Copy />
										Duplicate &amp; customize
									</DropdownMenuItem>
									{installedSkill ? (
										<>
											<DropdownMenuItem onSelect={onRename}>
												<Settings2 />
												Rename in library
											</DropdownMenuItem>
											{template.source === 'user' ? (
												<DropdownMenuItem onSelect={onEdit}>
													<Pencil />
													Edit skill
												</DropdownMenuItem>
											) : null}
											{installedSkill.updateAvailable ? (
												<DropdownMenuItem onSelect={onUpgrade}>
													<RefreshCw />
													Update to latest
												</DropdownMenuItem>
											) : null}
											{collections.some(
												(collection) => !collection.isDefault
											) ? (
												<DropdownMenuSub>
													<DropdownMenuSubTrigger>
														<Library />
														Collections
													</DropdownMenuSubTrigger>
													<DropdownMenuSubContent className="w-52">
														{collections
															.filter((collection) => !collection.isDefault)
															.map((collection) => {
																const included = collection.items.some(
																	(item) => item.id === installedSkill.id
																)
																return (
																	<DropdownMenuCheckboxItem
																		key={collection.id}
																		checked={included}
																		onSelect={(event) => event.preventDefault()}
																		onCheckedChange={() =>
																			onToggleCollection?.(
																				collection.id,
																				included
																			)
																		}
																	>
																		{collection.name}
																	</DropdownMenuCheckboxItem>
																)
															})}
													</DropdownMenuSubContent>
												</DropdownMenuSub>
											) : null}
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={onDelete}
											>
												<Trash2 />
												Remove from library
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
					<p className="text-xs text-muted-foreground/60">
						{template.source === 'first_party' ? 'Fork AI' : 'Private'}
					</p>
				</div>
			</div>

			{installedSkill?.pinned || installedSkill?.updateAvailable ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{installedSkill.pinned ? (
						<Badge variant="secondary" className="text-[10px]">
							Pinned
						</Badge>
					) : null}
					{installedSkill.updateAvailable ? (
						<Badge variant="secondary" className="text-[10px]">
							Update ready
						</Badge>
					) : null}
				</div>
			) : null}

			<div className="mt-3 flex-1">
				<p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground/80">
					{template.description || template.summary}
				</p>
			</div>

			<div className="mt-4 flex">
				<Button
					type="button"
					size="sm"
					variant={isActive ? 'secondary' : 'outline'}
					className={cn(
						'h-8 w-full rounded-lg text-xs font-medium transition-all',
						isActive
							? 'bg-primary/20 text-primary hover:bg-primary/30 border-none'
							: 'border-white/10 bg-white/5 hover:bg-white/10 text-foreground/90'
					)}
					onClick={isActive ? onRemoveFromChat : onAddToChat}
					disabled={isBusy || installedSkill?.enabled === false}
					aria-label={activationLabel}
				>
					{isActive
						? 'Added to chat'
						: installedSkill?.enabled === false
							? 'Disabled'
							: installedSkill
								? 'Add to chat'
								: 'Install & Add'}
				</Button>
			</div>
		</div>
	)
}

type SkillEditorMode = 'blank' | 'duplicate' | 'edit'

interface EditorSource {
	templateId: string
	title: string
	installedSkillId?: string
}

function createBlankSkillForm(): CreateSkillTemplateInput {
	return {
		name: '',
		description: '',
		whenToUse: '',
		instructions: '',
		outputFormat: '',
		examples: [],
		isEnabled: true,
	}
}

function SkillForm({
	value,
	mode,
	source,
	isBusy,
	onChange,
	onReset,
	onSubmit,
}: {
	value: CreateSkillTemplateInput
	mode: SkillEditorMode
	source: EditorSource | null
	isBusy: boolean
	onChange: (_value: CreateSkillTemplateInput) => void
	onReset: () => void
	onSubmit: () => void
}) {
	const canSubmit =
		value.name.trim().length >= 3 &&
		value.description.trim().length >= 10 &&
		value.whenToUse.trim().length >= 10 &&
		value.instructions.trim().length >= 10 &&
		value.examples.every(
			(example) =>
				example.userRequest.trim().length > 0 &&
				example.idealResponse.trim().length > 0
		)

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
			<div className="flex items-start justify-between gap-6 border-b border-white/10 pb-5">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold text-foreground">
						{mode === 'duplicate'
							? 'Create from a template'
							: mode === 'edit'
								? 'Edit skill'
								: 'Create a skill'}
					</h2>
					<p className="text-sm text-muted-foreground">
						{mode === 'duplicate' && source
							? `Starting from ${source.title}. Saving creates a separate private skill.`
							: mode === 'edit' && source
								? `Editing ${source.title}. Saving creates a new immutable version.`
								: 'Build a private skill from a blank form.'}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onReset}
					disabled={isBusy}
					className="shrink-0 gap-2"
				>
					<RotateCcw className="h-4 w-4" />
					{mode === 'duplicate'
						? 'Reset to blank'
						: mode === 'edit'
							? 'Reset changes'
							: 'Reset form'}
				</Button>
			</div>

			<div className="space-y-2">
				<Label htmlFor="skill-name">
					Name <span className="text-destructive">Required</span>
				</Label>
				<Input
					id="skill-name"
					value={value.name}
					onChange={(event) => onChange({ ...value, name: event.target.value })}
					className="bg-black/20"
				/>
				<p className="text-xs text-muted-foreground">
					A clear name such as SQL Helper.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="skill-description">
					Description <span className="text-destructive">Required</span>
				</Label>
				<Textarea
					id="skill-description"
					value={value.description}
					onChange={(event) =>
						onChange({ ...value, description: event.target.value })
					}
					className="min-h-20 bg-black/20"
				/>
				<p className="text-xs text-muted-foreground">
					A short summary of what the skill does.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="skill-trigger">
					When to use <span className="text-destructive">Required</span>
				</Label>
				<Textarea
					id="skill-trigger"
					value={value.whenToUse}
					onChange={(event) =>
						onChange({ ...value, whenToUse: event.target.value })
					}
					className="min-h-24 bg-black/20"
				/>
				<p className="text-xs text-muted-foreground">
					Describe the requests or situations where the AI should apply this
					skill.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="skill-instructions">
					Instructions <span className="text-destructive">Required</span>
				</Label>
				<Textarea
					id="skill-instructions"
					value={value.instructions}
					onChange={(event) =>
						onChange({ ...value, instructions: event.target.value })
					}
					className="min-h-40 bg-black/20"
				/>
				<p className="text-xs text-muted-foreground">
					The main behavior, process, and rules the model should follow.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="skill-output-format">
					Output format <span className="text-muted-foreground">Optional</span>
				</Label>
				<Textarea
					id="skill-output-format"
					value={value.outputFormat}
					onChange={(event) =>
						onChange({ ...value, outputFormat: event.target.value })
					}
					className="min-h-24 bg-black/20"
				/>
				<p className="text-xs text-muted-foreground">
					Specify headings, JSON, tables, bullets, or another response shape.
				</p>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between gap-4">
					<div>
						<Label>
							Examples <span className="text-muted-foreground">Optional</span>
						</Label>
						<p className="mt-1 text-xs text-muted-foreground">
							Add a user request and the ideal response it should produce.
						</p>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() =>
							onChange({
								...value,
								examples: [
									...value.examples,
									{ userRequest: '', idealResponse: '' },
								],
							})
						}
						disabled={value.examples.length >= 8}
						className="gap-2"
					>
						<Plus className="h-4 w-4" />
						Add example
					</Button>
				</div>

				{value.examples.map((example, index) => (
					<div
						key={index}
						className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-4"
					>
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">Example {index + 1}</p>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								onClick={() =>
									onChange({
										...value,
										examples: value.examples.filter(
											(_, exampleIndex) => exampleIndex !== index
										),
									})
								}
								title={`Remove example ${index + 1}`}
								className="h-8 w-8 text-muted-foreground hover:text-destructive"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`skill-example-request-${index}`}>
								User request
							</Label>
							<Textarea
								id={`skill-example-request-${index}`}
								value={example.userRequest}
								onChange={(event) => {
									const examples = [...value.examples]
									examples[index] = {
										...example,
										userRequest: event.target.value,
									}
									onChange({ ...value, examples })
								}}
								className="min-h-20 bg-black/20"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`skill-example-response-${index}`}>
								Ideal response
							</Label>
							<Textarea
								id={`skill-example-response-${index}`}
								value={example.idealResponse}
								onChange={(event) => {
									const examples = [...value.examples]
									examples[index] = {
										...example,
										idealResponse: event.target.value,
									}
									onChange({ ...value, examples })
								}}
								className="min-h-28 bg-black/20"
							/>
						</div>
					</div>
				))}
			</div>

			<div className="flex items-center justify-between gap-6 rounded-lg border border-white/10 bg-black/10 p-4">
				<div className="space-y-1">
					<Label htmlFor="skill-enabled">
						Enabled <span className="text-destructive">Required</span>
					</Label>
					<p className="text-xs text-muted-foreground">
						Disabled skills stay in your library but cannot be activated.
					</p>
				</div>
				<Switch
					id="skill-enabled"
					checked={value.isEnabled}
					onCheckedChange={(isEnabled) => onChange({ ...value, isEnabled })}
				/>
			</div>

			<Button
				type="button"
				onClick={onSubmit}
				disabled={isBusy || !canSubmit}
				className="w-fit gap-2"
			>
				<Save className="h-4 w-4" />
				{mode === 'edit' ? 'Save new version' : 'Save private skill'}
			</Button>
		</div>
	)
}

export function SkillPicker({
	conversationId,
	activeSkills,
	onActivateSkill,
	onRemoveActiveSkill,
}: SkillPickerProps) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [tab, setTab] = useState('templates')
	const [editorMode, setEditorMode] = useState<SkillEditorMode>('blank')
	const [blankDraft, setBlankDraft] =
		useState<CreateSkillTemplateInput>(createBlankSkillForm)
	const [duplicateDraft, setDuplicateDraft] =
		useState<CreateSkillTemplateInput>(createBlankSkillForm)
	const [editDraft, setEditDraft] =
		useState<CreateSkillTemplateInput>(createBlankSkillForm)
	const [editorSource, setEditorSource] = useState<EditorSource | null>(null)
	const [busySkillId, setBusySkillId] = useState<string | null>(null)
	const [collectionFilter, setCollectionFilter] = useState('all')
	const [librarySort, setLibrarySort] = useState('server')
	const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
	const [collectionName, setCollectionName] = useState('')
	const [renameTarget, setRenameTarget] = useState<InstalledSkillView | null>(
		null
	)
	const [renameValue, setRenameValue] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<InstalledSkillView | null>(
		null
	)
	const [deleteCollectionTarget, setDeleteCollectionTarget] =
		useState<SkillCollectionView | null>(null)
	const { toast } = useToast()
	const { data: templates = [], isLoading: templatesLoading } =
		useSkillTemplates()
	const { data: installedSkills = [], isLoading: installedLoading } =
		useInstalledSkills()
	const { data: collections = [] } = useSkillCollections()
	const {
		createSkill,
		updateSkill,
		installSkill,
		updateInstalledSkill,
		deleteInstalledSkill,
		upgradeInstalledSkill,
		createCollection,
		addSkillToCollection,
		removeSkillFromCollection,
		deleteCollection,
		bindConversationSkill,
	} = useSkillActions(conversationId)

	const installedByTemplate = useMemo(() => {
		return new Map(installedSkills.map((skill) => [skill.templateId, skill]))
	}, [installedSkills])

	const activeIds = useMemo(
		() => new Set(activeSkills.map((skill) => skill.installedSkillId)),
		[activeSkills]
	)
	const activeDraft =
		editorMode === 'blank'
			? blankDraft
			: editorMode === 'duplicate'
				? duplicateDraft
				: editDraft

	const filteredTemplates = templates.filter((template) => {
		const q = query.trim().toLowerCase()
		if (!q) return true
		return [
			template.title,
			template.summary,
			template.description,
			template.category,
			...template.tags,
		]
			.join(' ')
			.toLowerCase()
			.includes(q)
	})
	const visibleInstalledSkills = useMemo(() => {
		const collectionIds =
			collectionFilter === 'all'
				? null
				: new Set(
						collections
							.find((collection) => collection.id === collectionFilter)
							?.items.map((item) => item.id) ?? []
					)
		const filtered = collectionIds
			? installedSkills.filter((skill) => collectionIds.has(skill.id))
			: [...installedSkills]
		const normalizedQuery = query.trim().toLowerCase()
		const searched = normalizedQuery
			? filtered.filter((skill) =>
					[
						skill.alias,
						skill.template.title,
						skill.template.summary,
						skill.template.description,
						skill.template.category,
						...skill.template.tags,
					]
						.filter(Boolean)
						.join(' ')
						.toLowerCase()
						.includes(normalizedQuery)
				)
			: filtered
		if (librarySort === 'name') {
			return searched.sort((left, right) =>
				(left.alias ?? left.template.title).localeCompare(
					right.alias ?? right.template.title
				)
			)
		}
		if (librarySort === 'recent') {
			return searched.sort(
				(left, right) =>
					new Date(right.lastUsedAt ?? right.installedAt).getTime() -
					new Date(left.lastUsedAt ?? left.installedAt).getTime()
			)
		}
		return searched
	}, [collectionFilter, collections, installedSkills, librarySort, query])
	const selectedCollection =
		collectionFilter === 'all'
			? null
			: (collections.find((collection) => collection.id === collectionFilter) ??
				null)

	function showError(title: string, error: unknown) {
		toast({
			title,
			description: error instanceof Error ? error.message : 'Please try again.',
			variant: 'destructive',
		})
	}

	async function ensureInstalled(template: SkillTemplate) {
		const existing = installedByTemplate.get(template.id)
		if (existing?.updateAvailable) {
			return upgradeInstalledSkill(existing.id)
		}
		if (existing) return existing
		return installSkill(template.id, template.versionId)
	}

	async function activate(
		template: SkillTemplate,
		scope: 'turn' | 'conversation'
	) {
		setBusySkillId(template.id)
		try {
			const installedSkill = await ensureInstalled(template)
			const binding =
				scope === 'conversation'
					? await bindConversationSkill(installedSkill.id)
					: null
			onActivateSkill(
				activeSkillFromInstalled(installedSkill, scope, binding?.id)
			)
			if (scope === 'turn') {
				setOpen(false)
			}
		} catch (error) {
			showError('Could not add skill', error)
		} finally {
			setBusySkillId(null)
		}
	}

	async function savePrivateSkill() {
		setBusySkillId('create')
		try {
			if (editorMode === 'edit' && editorSource?.installedSkillId) {
				await updateSkill(editorSource.templateId, activeDraft)
				let installedSkill = await upgradeInstalledSkill(
					editorSource.installedSkillId
				)
				if (installedSkill.enabled !== activeDraft.isEnabled) {
					installedSkill = await updateInstalledSkill(installedSkill.id, {
						enabled: activeDraft.isEnabled,
					})
				}
				setEditDraft(createBlankSkillForm())
				setEditorSource(null)
				setEditorMode('blank')
				setTab('installed')
				toast({
					title: 'Skill updated',
					description: `Version ${installedSkill.template.versionNumber} is now installed.`,
				})
				return
			}

			const template = await createSkill(activeDraft)
			let installedSkill = await installSkill(template.id, template.versionId)
			if (!activeDraft.isEnabled) {
				installedSkill = await updateInstalledSkill(installedSkill.id, {
					enabled: false,
				})
			}
			if (editorMode === 'blank') {
				setBlankDraft(createBlankSkillForm())
			} else {
				setDuplicateDraft(createBlankSkillForm())
				setEditorSource(null)
				setEditorMode('blank')
			}
			setTab('installed')
			if (installedSkill.enabled) {
				const binding = await bindConversationSkill(installedSkill.id)
				onActivateSkill(
					activeSkillFromInstalled(installedSkill, 'conversation', binding?.id)
				)
			}
			toast({
				title: 'Skill created',
				description: `${template.title} was added to My Library.`,
			})
		} catch (error) {
			showError(
				editorMode === 'edit'
					? 'Could not update skill'
					: 'Could not create skill',
				error
			)
		} finally {
			setBusySkillId(null)
		}
	}

	function startFromTemplate(template: SkillTemplate) {
		setDuplicateDraft({
			name: `${template.title} copy`,
			description: template.description,
			whenToUse: template.whenToUse ?? template.instructions.role,
			instructions:
				template.mainInstructions ?? template.instructions.workflow.join('\n'),
			outputFormat:
				template.outputFormat ?? template.instructions.outputContract,
			examples: template.examples ?? [],
			isEnabled: true,
		})
		setEditorSource({ templateId: template.id, title: template.title })
		setEditorMode('duplicate')
		setTab('create')
	}

	function startEditing(installedSkill: InstalledSkillView) {
		const template = installedSkill.template
		setEditDraft({
			name: template.title,
			description: template.description,
			whenToUse: template.whenToUse ?? template.instructions.role,
			instructions:
				template.mainInstructions ?? template.instructions.workflow.join('\n'),
			outputFormat:
				template.outputFormat ?? template.instructions.outputContract,
			examples: template.examples ?? [],
			isEnabled: installedSkill.enabled,
		})
		setEditorSource({
			templateId: template.id,
			title: template.title,
			installedSkillId: installedSkill.id,
		})
		setEditorMode('edit')
		setTab('create')
	}

	function resetEditor() {
		if (editorMode === 'duplicate') {
			setDuplicateDraft(createBlankSkillForm())
			setEditorSource(null)
			setBlankDraft(createBlankSkillForm())
			setEditorMode('blank')
			return
		}
		if (editorMode === 'edit' && editorSource?.installedSkillId) {
			const installedSkill = installedSkills.find(
				(skill) => skill.id === editorSource.installedSkillId
			)
			if (installedSkill) startEditing(installedSkill)
			return
		}
		setBlankDraft(createBlankSkillForm())
	}

	function changeEditorTab(nextTab: string) {
		if (nextTab === 'create') {
			setEditorMode('blank')
			setEditorSource(null)
		}
		setTab(nextTab)
	}

	function updateActiveDraft(value: CreateSkillTemplateInput) {
		if (editorMode === 'blank') {
			setBlankDraft(value)
		} else if (editorMode === 'duplicate') {
			setDuplicateDraft(value)
		} else {
			setEditDraft(value)
		}
	}

	async function runInstalledMutation(
		installedSkill: InstalledSkillView,
		action: () => Promise<unknown>,
		successTitle?: string
	) {
		setBusySkillId(installedSkill.template.id)
		try {
			await action()
			if (successTitle) toast({ title: successTitle })
		} catch (error) {
			showError('Skill change failed', error)
		} finally {
			setBusySkillId(null)
		}
	}

	async function toggleCollectionMembership(
		installedSkill: InstalledSkillView,
		collectionId: string,
		included: boolean
	) {
		await runInstalledMutation(
			installedSkill,
			() =>
				included
					? removeSkillFromCollection(collectionId, installedSkill.id)
					: addSkillToCollection(collectionId, installedSkill.id),
			included ? 'Removed from collection' : 'Added to collection'
		)
	}

	async function saveCollection() {
		const name = collectionName.trim()
		if (!name) return
		try {
			await createCollection(name)
			setCollectionName('')
			setCollectionDialogOpen(false)
			toast({ title: 'Collection created' })
		} catch (error) {
			showError('Could not create collection', error)
		}
	}

	async function saveRename() {
		if (!renameTarget) return
		const alias = renameValue.trim()
		const nextAlias =
			alias && alias !== renameTarget.template.title ? alias : null
		await runInstalledMutation(
			renameTarget,
			() => updateInstalledSkill(renameTarget.id, { alias: nextAlias }),
			'Skill renamed'
		)
		setRenameTarget(null)
		setRenameValue('')
	}

	async function removeSelectedCollection() {
		if (!deleteCollectionTarget || deleteCollectionTarget.isDefault) return
		try {
			await deleteCollection(deleteCollectionTarget.id)
			setCollectionFilter('all')
			setDeleteCollectionTarget(null)
			toast({ title: 'Collection deleted' })
		} catch (error) {
			showError('Could not delete collection', error)
		}
	}

	async function removeInstalledSkill() {
		if (!deleteTarget) return
		const target = deleteTarget
		await runInstalledMutation(
			target,
			async () => {
				onRemoveActiveSkill?.(target.id)
				await deleteInstalledSkill(target.id)
			},
			'Skill removed'
		)
		setDeleteTarget(null)
	}

	const loading = templatesLoading || installedLoading

	const [activeTab, setActiveTab] = useState('skills')

	return (
		<>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					<button
						type="button"
						className={cn(
							'flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:text-primary',
							activeSkills.length > 0 && 'border-primary/50 text-primary'
						)}
						title="Choose chat skill"
					>
						<Blocks className="h-3.5 w-3.5" />
						<span>Directory</span>
						{activeSkills.length > 0 ? (
							<span className="rounded bg-primary/15 px-1 text-[10px] text-primary">
								{activeSkills.length}
							</span>
						) : null}
					</button>
				</DialogTrigger>
				<DialogContent className="flex h-[85vh] max-h-[900px] w-[90vw] max-w-[1200px] flex-row gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#1E1E22] p-0 text-foreground shadow-2xl dark sm:max-w-[1200px]">
					{/* Sidebar */}
					<div className="flex w-64 flex-col border-r border-white/5 bg-[#18181B]">
						<div className="px-6 py-8">
							<DialogTitle className="font-serif text-2xl font-medium tracking-tight text-foreground/90">
								Directory
							</DialogTitle>
							<DialogDescription className="sr-only">
								Browse and manage skills, connectors, and plugins.
							</DialogDescription>
						</div>
						<nav className="flex flex-col gap-1 px-4">
							<button
								onClick={() => setActiveTab('skills')}
								className={cn(
									'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
									activeTab === 'skills'
										? 'bg-white/10 text-foreground'
										: 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
								)}
							>
								<Blocks className="h-4 w-4" /> Skills
							</button>
							<button
								onClick={() => setActiveTab('connectors')}
								className={cn(
									'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
									activeTab === 'connectors'
										? 'bg-white/10 text-foreground'
										: 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
								)}
							>
								<Plug className="h-4 w-4" /> Connectors
							</button>
							<button
								onClick={() => setActiveTab('plugins')}
								className={cn(
									'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
									activeTab === 'plugins'
										? 'bg-white/10 text-foreground'
										: 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
								)}
							>
								<Puzzle className="h-4 w-4" /> Plugins
							</button>
						</nav>
					</div>

					{/* Main Content Area */}
					<div className="flex flex-1 flex-col bg-[#1E1E22]">
						<Tabs
							value={tab}
							onValueChange={changeEditorTab}
							className="flex min-h-0 flex-1 flex-col"
						>
							<div className="flex flex-col gap-5 border-b border-white/5 px-8 pb-4 pt-8">
								{/* Search */}
								<div className="relative">
									<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
									<Input
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										placeholder="Search skills..."
										className="h-10 rounded-lg border-none bg-black/20 pl-10 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary/50"
									/>
								</div>

								{/* Filters */}
								<div className="flex items-center justify-between">
									<TabsList className="h-auto gap-2 bg-transparent p-0">
										<TabsTrigger
											value="templates"
											className="rounded-full border border-white/5 bg-black/20 px-4 py-1.5 text-xs font-medium text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground"
										>
											Templates
										</TabsTrigger>
										<TabsTrigger
											value="installed"
											className="rounded-full border border-white/5 bg-black/20 px-4 py-1.5 text-xs font-medium text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground"
										>
											My Library
										</TabsTrigger>
										<TabsTrigger
											value="create"
											onClick={() => setEditorMode('blank')}
											className="rounded-full border border-white/5 bg-black/20 px-4 py-1.5 text-xs font-medium text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground"
										>
											Create
										</TabsTrigger>
									</TabsList>

									{tab === 'installed' ? (
										<div className="flex items-center gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-8 gap-2 border-white/10 bg-transparent text-xs"
												onClick={() => setCollectionDialogOpen(true)}
											>
												<FolderPlus className="h-3.5 w-3.5" />
												New collection
											</Button>
											<Select
												value={collectionFilter}
												onValueChange={setCollectionFilter}
											>
												<SelectTrigger
													className="h-8 w-40 border-white/10 bg-transparent text-xs"
													aria-label="Filter library by collection"
												>
													<SelectValue placeholder="All skills" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all">All skills</SelectItem>
													{collections
														.filter((collection) => !collection.isDefault)
														.map((collection) => (
															<SelectItem
																key={collection.id}
																value={collection.id}
															>
																{collection.name}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
											<Select
												value={librarySort}
												onValueChange={setLibrarySort}
											>
												<SelectTrigger
													className="h-8 w-36 border-white/10 bg-transparent text-xs"
													aria-label="Sort library"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="server">Pinned first</SelectItem>
													<SelectItem value="recent">Recently used</SelectItem>
													<SelectItem value="name">Name</SelectItem>
												</SelectContent>
											</Select>
											{selectedCollection && !selectedCollection.isDefault ? (
												<Button
													type="button"
													size="icon"
													variant="ghost"
													className="h-8 w-8 text-muted-foreground hover:text-destructive"
													onClick={() =>
														setDeleteCollectionTarget(selectedCollection)
													}
													aria-label={`Delete ${selectedCollection.name} collection`}
													title={`Delete ${selectedCollection.name} collection`}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											) : null}
										</div>
									) : null}
								</div>
							</div>

							<div className="flex-1 overflow-hidden">
								<TabsContent value="templates" className="m-0 h-full">
									<ScrollArea className="h-full px-8 py-6">
										{activeTab !== 'skills' ? (
											<div className="flex flex-col items-center justify-center py-20 text-center">
												<p className="text-sm text-muted-foreground">
													This section is coming soon.
												</p>
											</div>
										) : (
											<div className="grid grid-cols-1 gap-4 pb-8 md:grid-cols-2 lg:grid-cols-2">
												{loading ? (
													<div className="col-span-full flex flex-col items-center justify-center space-y-3 py-12">
														<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
													</div>
												) : null}
												{!loading && filteredTemplates.length === 0 ? (
													<div className="col-span-full flex flex-col items-center justify-center space-y-3 py-12 text-center">
														<Wand2 className="h-8 w-8 text-muted-foreground/30" />
														<p className="text-sm text-muted-foreground">
															No matching skills found.
														</p>
													</div>
												) : null}
												{filteredTemplates.map((template) => {
													const installedSkill = installedByTemplate.get(
														template.id
													)
													return (
														<SkillCard
															key={template.id}
															template={template}
															installedSkill={installedSkill}
															isActive={
																installedSkill
																	? activeIds.has(installedSkill.id)
																	: false
															}
															isBusy={busySkillId === template.id}
															collections={collections}
															onAddToChat={() =>
																void activate(template, 'conversation')
															}
															onPin={() => {
																if (!installedSkill) return
																void runInstalledMutation(installedSkill, () =>
																	updateInstalledSkill(installedSkill.id, {
																		pinned: !installedSkill.pinned,
																	})
																)
															}}
															onToggleEnabled={() => {
																if (!installedSkill) return
																if (installedSkill.enabled) {
																	onRemoveActiveSkill?.(installedSkill.id)
																}
																void runInstalledMutation(installedSkill, () =>
																	updateInstalledSkill(installedSkill.id, {
																		enabled: !installedSkill.enabled,
																	})
																)
															}}
															onDelete={() => {
																if (!installedSkill) return
																setDeleteTarget(installedSkill)
															}}
															onUseAsStartingPoint={() =>
																startFromTemplate(template)
															}
															onEdit={
																installedSkill
																	? () => startEditing(installedSkill)
																	: undefined
															}
															onRename={
																installedSkill
																	? () => {
																			setRenameTarget(installedSkill)
																			setRenameValue(
																				installedSkill.alias ??
																					installedSkill.template.title
																			)
																		}
																	: undefined
															}
															onUpgrade={
																installedSkill
																	? () =>
																			void runInstalledMutation(
																				installedSkill,
																				() =>
																					upgradeInstalledSkill(
																						installedSkill.id
																					),
																				'Skill updated'
																			)
																	: undefined
															}
															onToggleCollection={(collectionId, included) => {
																if (!installedSkill) return
																void toggleCollectionMembership(
																	installedSkill,
																	collectionId,
																	included
																)
															}}
															onRemoveFromChat={() => {
																if (installedSkill && onRemoveActiveSkill) {
																	onRemoveActiveSkill(installedSkill.id)
																}
															}}
														/>
													)
												})}
											</div>
										)}
									</ScrollArea>
								</TabsContent>

								<TabsContent value="installed" className="m-0 h-full">
									<ScrollArea className="h-full px-8 py-6">
										{activeTab !== 'skills' ? (
											<div className="flex flex-col items-center justify-center py-20 text-center">
												<p className="text-sm text-muted-foreground">
													This section is coming soon.
												</p>
											</div>
										) : (
											<div className="grid grid-cols-1 gap-4 pb-8 md:grid-cols-2 lg:grid-cols-2">
												{installedSkills.length === 0 ? (
													<div className="col-span-full flex flex-col items-center justify-center space-y-3 py-12 text-center">
														<Library className="h-8 w-8 text-muted-foreground/30" />
														<p className="text-sm text-muted-foreground">
															No installed skills yet.
														</p>
													</div>
												) : null}
												{installedSkills.length > 0 &&
												visibleInstalledSkills.length === 0 ? (
													<div className="col-span-full flex flex-col items-center justify-center space-y-3 py-12 text-center">
														<Search className="h-8 w-8 text-muted-foreground/30" />
														<p className="text-sm text-muted-foreground">
															No skills match this view.
														</p>
													</div>
												) : null}
												{visibleInstalledSkills.map((installedSkill) => {
													const template = installedSkill.template
													return (
														<SkillCard
															key={installedSkill.id}
															template={template}
															installedSkill={installedSkill}
															isActive={activeIds.has(installedSkill.id)}
															isBusy={busySkillId === template.id}
															collections={collections}
															onAddToChat={() =>
																void activate(template, 'conversation')
															}
															onPin={() =>
																void runInstalledMutation(installedSkill, () =>
																	updateInstalledSkill(installedSkill.id, {
																		pinned: !installedSkill.pinned,
																	})
																)
															}
															onToggleEnabled={() => {
																if (installedSkill.enabled) {
																	onRemoveActiveSkill?.(installedSkill.id)
																}
																void runInstalledMutation(installedSkill, () =>
																	updateInstalledSkill(installedSkill.id, {
																		enabled: !installedSkill.enabled,
																	})
																)
															}}
															onDelete={() => setDeleteTarget(installedSkill)}
															onUseAsStartingPoint={() =>
																startFromTemplate(template)
															}
															onEdit={() => startEditing(installedSkill)}
															onRename={() => {
																setRenameTarget(installedSkill)
																setRenameValue(
																	installedSkill.alias ??
																		installedSkill.template.title
																)
															}}
															onUpgrade={() =>
																void runInstalledMutation(
																	installedSkill,
																	() =>
																		upgradeInstalledSkill(installedSkill.id),
																	'Skill updated'
																)
															}
															onToggleCollection={(collectionId, included) =>
																void toggleCollectionMembership(
																	installedSkill,
																	collectionId,
																	included
																)
															}
															onRemoveFromChat={() => {
																if (installedSkill && onRemoveActiveSkill) {
																	onRemoveActiveSkill(installedSkill.id)
																}
															}}
														/>
													)
												})}
											</div>
										)}
									</ScrollArea>
								</TabsContent>

								<TabsContent value="create" className="m-0 h-full">
									<ScrollArea className="h-full px-8 py-6">
										{activeTab !== 'skills' ? (
											<div className="flex flex-col items-center justify-center py-20 text-center">
												<p className="text-sm text-muted-foreground">
													This section is coming soon.
												</p>
											</div>
										) : (
											<SkillForm
												value={activeDraft}
												mode={editorMode}
												source={editorSource}
												isBusy={busySkillId === 'create'}
												onChange={updateActiveDraft}
												onReset={resetEditor}
												onSubmit={() => void savePrivateSkill()}
											/>
										)}
									</ScrollArea>
								</TabsContent>
							</div>
						</Tabs>
					</div>
				</DialogContent>
			</Dialog>

			{collectionDialogOpen ? (
				<Dialog
					open
					onOpenChange={(nextOpen) => {
						setCollectionDialogOpen(nextOpen)
						if (!nextOpen) setCollectionName('')
					}}
				>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Create collection</DialogTitle>
							<DialogDescription>
								Group installed skills without changing whether they are
								enabled.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor="skill-collection-name">Name</Label>
							<Input
								id="skill-collection-name"
								value={collectionName}
								onChange={(event) => setCollectionName(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') void saveCollection()
								}}
								maxLength={80}
								autoFocus
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCollectionDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => void saveCollection()}
								disabled={!collectionName.trim()}
							>
								Create
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}

			{renameTarget ? (
				<Dialog
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							setRenameTarget(null)
							setRenameValue('')
						}
					}}
				>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Rename in library</DialogTitle>
							<DialogDescription>
								This changes only your library label. The skill template keeps
								its original name.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor="installed-skill-alias">Library name</Label>
							<Input
								id="installed-skill-alias"
								value={renameValue}
								onChange={(event) => setRenameValue(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') void saveRename()
								}}
								maxLength={80}
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								Use the original name to remove a custom alias.
							</p>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setRenameTarget(null)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => void saveRename()}
								disabled={!renameValue.trim()}
							>
								Save
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}

			{deleteTarget ? (
				<AlertDialog
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) setDeleteTarget(null)
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove this skill?</AlertDialogTitle>
							<AlertDialogDescription>
								{deleteTarget
									? `${deleteTarget.alias ?? deleteTarget.template.title} will be removed from your library and active chats. Historical message traces remain available.`
									: ''}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => void removeInstalledSkill()}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								Remove
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}

			{deleteCollectionTarget ? (
				<AlertDialog
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) setDeleteCollectionTarget(null)
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete this collection?</AlertDialogTitle>
							<AlertDialogDescription>
								{deleteCollectionTarget
									? `${deleteCollectionTarget.name} will be deleted. Its skills remain installed in your library.`
									: ''}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => void removeSelectedCollection()}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}
		</>
	)
}
