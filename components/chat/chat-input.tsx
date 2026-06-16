'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettings } from '@/hooks/use-settings'
import {
	CHAT_MODELS,
	DOCUMENT_ATTACHMENT_ACCEPT,
	IMAGE_ATTACHMENT_ACCEPT,
	type ChatModelMetadata,
} from '@/lib/ai/model-catalog'
import { CHAT_CONSTANTS } from '@/lib/constants'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import type { ActiveChatSkill } from '@/hooks/use-skills'
import {
	ArrowUp,
	ChevronDown,
	FileText,
	GitBranch,
	Globe,
	ImageIcon,
	ListOrdered,
	Loader2,
	Mic,
	Paperclip,
	Pause,
	Play,
	Reply,
	Sparkles,
	Star,
	Trash2,
	X,
} from 'lucide-react'
import {
	type ChatAttachmentInput,
	type ChatEnabledTool,
} from '@/hooks/use-chat'
import {
	ClipboardEvent,
	forwardRef,
	KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react'
import { ModelsModal, type Model } from './models-modal'
import { SkillPicker } from './skill-picker'

const ALL_MODELS: Model[] = CHAT_MODELS.map((model) => ({ ...model }))
const MAX_PARALLEL_UPLOADS = 3
const MAX_PARALLEL_DIRECT_PART_UPLOADS = 3
const DIRECT_UPLOAD_MIN_BYTES = 5 * 1024 * 1024
const CHAT_AUDIO_INPUT_ENABLED = false
const ATTACHMENT_UPLOAD_ACCEPT = `${DOCUMENT_ATTACHMENT_ACCEPT},${IMAGE_ATTACHMENT_ACCEPT}`
const MIME_EXTENSION: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'text/plain': '.txt',
	'text/markdown': '.md',
	'text/csv': '.csv',
	'application/pdf': '.pdf',
	'application/json': '.json',
}

function isImageFile(file: File) {
	return file.type.startsWith('image/')
}

function getUploadFilename(file: File) {
	if (file.name.trim()) {
		return file.name
	}

	const extension = MIME_EXTENSION[file.type] ?? ''
	const prefix = isImageFile(file) ? 'pasted-image' : 'pasted-file'
	return `${prefix}-${Date.now()}${extension}`
}

function getUploadFingerprint(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':')
}

function getClipboardFiles(clipboardData: DataTransfer) {
	const fileByFingerprint = new Map<string, File>()
	for (const file of Array.from(clipboardData.files ?? [])) {
		fileByFingerprint.set(getUploadFingerprint(file), file)
	}

	for (const item of Array.from(clipboardData.items ?? [])) {
		if (item.kind !== 'file') continue
		const file = item.getAsFile()
		if (!file) continue
		fileByFingerprint.set(getUploadFingerprint(file), file)
	}

	return Array.from(fileByFingerprint.values())
}

function isObjectUrl(url?: string | null): url is string {
	return typeof url === 'string' && url.startsWith('blob:')
}

function getAttachmentAccept(model: ChatModelMetadata) {
	return model.capabilities.supportsImages
		? ATTACHMENT_UPLOAD_ACCEPT
		: DOCUMENT_ATTACHMENT_ACCEPT
}

function createUploadError(payload: AttachmentUploadPayload, fallback: string) {
	const error = new Error(
		typeof payload.error === 'string' ? payload.error : fallback
	) as Error & { errorCode?: string }
	error.errorCode =
		typeof payload.errorCode === 'string'
			? payload.errorCode
			: 'FILE_UPLOAD_FAILED'
	return error
}

async function uploadAttachmentThroughServer(
	file: File,
	filename: string
): Promise<AttachmentStatusPayload> {
	const formData = new FormData()
	formData.append('file', file, filename)
	formData.append('filename', filename)
	const response = await fetch('/api/attachments', {
		method: 'POST',
		headers: createIdempotencyHeaders('attachment-upload'),
		body: formData,
	})
	const payload = (await response
		.json()
		.catch(() => ({}))) as AttachmentUploadPayload

	if (!response.ok || !payload.attachment) {
		throw createUploadError(payload, 'Upload failed')
	}

	return payload.attachment
}

async function uploadDirectPart(file: File, part: DirectUploadPart) {
	const response = await fetch(part.url, {
		method: 'PUT',
		body: file.slice(part.startByte, part.endByte, file.type || undefined),
	})
	if (!response.ok) {
		throw new Error('Direct part upload failed')
	}

	const etag = response.headers.get('ETag')
	if (!etag) {
		throw new Error('Direct part upload did not return an ETag')
	}

	return {
		partNumber: part.partNumber,
		etag,
	}
}

async function uploadDirectParts(file: File, parts: DirectUploadPart[]) {
	const completedParts: Array<{ partNumber: number; etag: string }> = []

	for (
		let index = 0;
		index < parts.length;
		index += MAX_PARALLEL_DIRECT_PART_UPLOADS
	) {
		const batch = parts.slice(index, index + MAX_PARALLEL_DIRECT_PART_UPLOADS)
		completedParts.push(
			...(await Promise.all(batch.map((part) => uploadDirectPart(file, part))))
		)
	}

	return completedParts.sort(
		(left, right) => left.partNumber - right.partNumber
	)
}

async function abortDirectUpload({
	fileObjectId,
	uploadId,
}: {
	fileObjectId: string
	uploadId: string
}) {
	await fetch('/api/attachments/direct/abort', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ fileObjectId, uploadId }),
	}).catch(() => undefined)
}

async function uploadAttachmentDirectlyIfAvailable(
	file: File,
	filename: string
): Promise<AttachmentStatusPayload | null> {
	if (file.size < DIRECT_UPLOAD_MIN_BYTES || !file.type) {
		return null
	}

	const initiateResponse = await fetch('/api/attachments/direct/initiate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			filename,
			mimeType: file.type,
			sizeBytes: file.size,
		}),
	})
	const initiatePayload = (await initiateResponse
		.json()
		.catch(() => ({}))) as DirectUploadPayload

	if (!initiateResponse.ok || !initiatePayload.upload) {
		if (initiatePayload.errorCode === 'DIRECT_UPLOAD_UNSUPPORTED') {
			return null
		}
		throw createUploadError(initiatePayload, 'Failed to start direct upload')
	}

	const { fileObjectId, uploadId, parts } = initiatePayload.upload
	let shouldAbort = true

	try {
		const completedParts = await uploadDirectParts(file, parts)
		const completeResponse = await fetch('/api/attachments/direct/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				fileObjectId,
				uploadId,
				parts: completedParts,
			}),
		})
		const completePayload = (await completeResponse
			.json()
			.catch(() => ({}))) as AttachmentUploadPayload

		if (!completeResponse.ok || !completePayload.attachment) {
			throw createUploadError(
				completePayload,
				'Failed to complete direct upload'
			)
		}

		shouldAbort = false
		return completePayload.attachment
	} catch (error) {
		if (shouldAbort) {
			await abortDirectUpload({ fileObjectId, uploadId })
		}
		throw error
	}
}

type AttachedFileStatus =
	| 'uploading'
	| 'uploaded'
	| 'processing'
	| 'ready'
	| 'failed'
type AttachedFileKind = 'document' | 'image'

interface AttachedFile {
	id: string
	filename: string
	kind: AttachedFileKind
	promptUse: 'rag' | 'vision'
	fileKind: string
	mimeType: string
	sizeBytes: number
	contentUrl?: string | null
	status: AttachedFileStatus
	chunkCount?: number
	errorCode?: string | null
}

interface AttachmentStatusPayload {
	id: string
	fileObjectId: string
	filename: string
	kind: AttachedFileKind
	fileKind: string
	purpose: string
	mimeType: string
	sizeBytes: number
	contentUrl?: string | null
	status: AttachedFileStatus
	chunkCount?: number
	errorCode?: string | null
}

interface AttachmentUploadPayload {
	attachment?: AttachmentStatusPayload
	error?: string
	errorCode?: string
}

interface DirectUploadPart {
	partNumber: number
	startByte: number
	endByte: number
	url: string
}

interface DirectUploadPayload extends AttachmentUploadPayload {
	upload?: {
		fileObjectId: string
		uploadId: string
		partSizeBytes: number
		expiresInSeconds: number
		storageProvider: 'r2'
		parts: DirectUploadPart[]
	}
}

interface ChatInputProps {
	onSendMessage: (
		_content: string,
		_model: string,
		_attachments?: ChatAttachmentInput[],
		_activeSkills?: ActiveChatSkill[],
		_enabledTools?: ChatEnabledTool[]
	) => Promise<void>
	onStop?: () => void
	isStreaming?: boolean
	disabled?: boolean
	conversationId?: string | null
	activeSkills?: ActiveChatSkill[]
	onActivateSkill?: (_skill: ActiveChatSkill) => void
	onRemoveActiveSkill?: (_installedSkillId: string) => void
	queuedMessages?: Array<{
		id: string
		content: string
		model: string
		createdAt: Date
	}>
	queueStatus?: 'idle' | 'running' | 'halted'
	onRemoveQueuedMessage?: (_id: string) => void
	onClearQueue?: () => void
	onResumeQueue?: () => void
	branchContext?: {
		messageId: string
		preview: string
		kind?: 'branch' | 'selected-reply'
	} | null
	onClearBranchContext?: () => void
	quoteInsertion?: {
		id: string
		text: string
	} | null
	onFocus?: () => void
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
	function ChatInput(
		{
			onSendMessage,
			onStop,
			isStreaming = false,
			disabled = false,
			conversationId = null,
			activeSkills = [],
			onActivateSkill,
			onRemoveActiveSkill,
			queuedMessages = [],
			queueStatus = 'idle',
			onRemoveQueuedMessage,
			onClearQueue,
			onResumeQueue,
			branchContext,
			onClearBranchContext,
			quoteInsertion,
			onFocus,
		},
		ref
	) {
		const [message, setMessage] = useState('')
		const textareaRef = useRef<HTMLTextAreaElement | null>(null)
		const fileInputRef = useRef<HTMLInputElement | null>(null)
		const handledQuoteInsertionRef = useRef<string | null>(null)
		const objectUrlsRef = useRef<Set<string>>(new Set())
		const uploadingFileFingerprintsRef = useRef<Set<string>>(new Set())
		const [isSubmitCoolingDown, setIsSubmitCoolingDown] = useState(false)
		const submitCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
			null
		)
		const [models, setModels] = useState(ALL_MODELS)
		const [selectedModel, setSelectedModel] = useState(
			models.find((m) => m.isFavorite) || models[0]
		)
		const [modelsModalOpen, setModelsModalOpen] = useState(false)
		const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
		const [webSearchEnabled, setWebSearchEnabled] = useState(false)
		const { settings } = useSettings()

		const favoriteModels = models.filter((m) => m.isFavorite)

		const resizeTextarea = useCallback(() => {
			const textarea = textareaRef.current
			if (!textarea) return

			const maxHeight = 224
			textarea.style.height = 'auto'
			const nextHeight = Math.min(textarea.scrollHeight, maxHeight)
			textarea.style.height = `${nextHeight}px`
			textarea.style.overflowY =
				textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
		}, [])

		const setTextareaRef = useCallback(
			(node: HTMLTextAreaElement | null) => {
				textareaRef.current = node
				if (node) {
					resizeTextarea()
				}

				if (typeof ref === 'function') {
					ref(node)
				} else if (ref) {
					ref.current = node
				}
			},
			[ref, resizeTextarea]
		)

		const handleToggleFavorite = (modelId: string) => {
			setModels((prev) =>
				prev.map((m) =>
					m.id === modelId ? { ...m, isFavorite: !m.isFavorite } : m
				)
			)
		}

		const handleSelectModel = (model: Model) => {
			setSelectedModel(model)
		}

		const getModelLabel = (modelId: string) =>
			models.find((model) => model.id === modelId)?.name ?? modelId

		const selectedModelSupportsImages =
			selectedModel.capabilities.supportsImages
		const selectedModelSupportsAudioInput =
			selectedModel.capabilities.supportsAudioInput
		const canUseAudioInput =
			selectedModelSupportsAudioInput && CHAT_AUDIO_INPUT_ENABLED
		const selectedModelSupportsImageGeneration =
			selectedModel.capabilities.supportsImageGeneration
		const selectedModelSupportsDocumentAttachments =
			selectedModel.capabilities.supportsDocumentAttachments
		const attachmentAccept = getAttachmentAccept(selectedModel)

		const registerObjectUrl = useCallback((url?: string | null) => {
			if (!isObjectUrl(url)) return
			objectUrlsRef.current.add(url)
		}, [])

		const revokeObjectUrl = useCallback((url?: string | null) => {
			if (!isObjectUrl(url)) return
			if (!objectUrlsRef.current.has(url)) return
			URL.revokeObjectURL(url)
			objectUrlsRef.current.delete(url)
		}, [])

		const isImmediateSend =
			!isStreaming && queueStatus === 'idle' && queuedMessages.length === 0

		const startSubmitCooldown = useCallback(() => {
			if (submitCooldownTimerRef.current) {
				clearTimeout(submitCooldownTimerRef.current)
			}

			setIsSubmitCoolingDown(true)
			submitCooldownTimerRef.current = setTimeout(() => {
				submitCooldownTimerRef.current = null
				setIsSubmitCoolingDown(false)
			}, CHAT_CONSTANTS.CHAT_SUBMIT_COOLDOWN_MS)
		}, [])

		useEffect(() => {
			const objectUrls = objectUrlsRef.current
			return () => {
				if (submitCooldownTimerRef.current) {
					clearTimeout(submitCooldownTimerRef.current)
				}
				for (const objectUrl of objectUrls) {
					URL.revokeObjectURL(objectUrl)
				}
				objectUrls.clear()
			}
		}, [])

		useEffect(() => {
			if (
				!quoteInsertion ||
				handledQuoteInsertionRef.current === quoteInsertion.id
			) {
				return
			}

			handledQuoteInsertionRef.current = quoteInsertion.id
			const quotedText = quoteInsertion.text
				.split(/\r?\n/)
				.map((line) => `> ${line}`)
				.join('\n')

			setMessage((currentMessage) => {
				const existingDraft = currentMessage.trimStart()
				return existingDraft
					? `${quotedText}\n\n${existingDraft}`
					: `${quotedText}\n\n`
			})

			window.setTimeout(() => {
				resizeTextarea()
				textareaRef.current?.focus()
				const length = textareaRef.current?.value.length ?? 0
				textareaRef.current?.setSelectionRange(length, length)
			}, 0)
		}, [quoteInsertion, resizeTextarea])

		useEffect(() => {
			resizeTextarea()
		}, [message, resizeTextarea])

		useEffect(() => {
			const filesToPoll = attachedFiles.filter(
				(file) => file.status === 'uploaded' || file.status === 'processing'
			)
			if (filesToPoll.length === 0) return

			const poll = async () => {
				const updates = await Promise.all(
					filesToPoll.map(async (file) => {
						try {
							const response = await fetch(`/api/attachments/${file.id}`)
							if (!response.ok) return null
							const payload = (await response.json()) as {
								attachment?: AttachmentStatusPayload
							}
							return payload.attachment ?? null
						} catch {
							return null
						}
					})
				)
				const updateById = new Map(
					updates
						.filter((file): file is AttachmentStatusPayload => Boolean(file))
						.map((file) => [file.id, file])
				)

				if (updateById.size === 0) return

				setAttachedFiles((currentFiles) =>
					currentFiles.map((file) => {
						const update = updateById.get(file.id)
						return update
							? {
									...file,
									kind: update.kind,
									fileKind: update.fileKind,
									promptUse: update.kind === 'image' ? 'vision' : 'rag',
									mimeType: update.mimeType,
									sizeBytes: update.sizeBytes,
									contentUrl: update.contentUrl,
									status: update.status,
									chunkCount: update.chunkCount,
									errorCode: update.errorCode,
								}
							: file
					})
				)
			}

			void poll()
			const interval = window.setInterval(poll, 2500)
			return () => window.clearInterval(interval)
		}, [attachedFiles])

		const uploadAttachmentFile = useCallback(
			async (file: File) => {
				const filename = getUploadFilename(file)
				const isImage = isImageFile(file)
				const temporaryId = `uploading-${Date.now()}-${Math.random()
					.toString(36)
					.slice(2, 8)}`
				const previewUrl = isImage ? URL.createObjectURL(file) : null
				registerObjectUrl(previewUrl)

				setAttachedFiles((currentFiles) => [
					...currentFiles,
					{
						id: temporaryId,
						filename,
						kind: isImage ? 'image' : 'document',
						promptUse: isImage ? 'vision' : 'rag',
						fileKind: isImage ? 'image' : 'text',
						mimeType: file.type || 'application/octet-stream',
						sizeBytes: file.size,
						contentUrl: previewUrl,
						status: 'uploading',
					},
				])

				try {
					const payload =
						(await uploadAttachmentDirectlyIfAvailable(file, filename)) ??
						(await uploadAttachmentThroughServer(file, filename))

					revokeObjectUrl(previewUrl)
					setAttachedFiles((currentFiles) =>
						currentFiles.map((attachedFile) =>
							attachedFile.id === temporaryId
								? {
										id: payload.fileObjectId,
										filename: payload.filename,
										kind: payload.kind,
										promptUse: payload.kind === 'image' ? 'vision' : 'rag',
										fileKind: payload.fileKind,
										mimeType: payload.mimeType,
										sizeBytes: payload.sizeBytes,
										contentUrl: payload.contentUrl,
										status: payload.status,
										chunkCount: payload.chunkCount,
										errorCode: payload.errorCode,
									}
								: attachedFile
						)
					)
				} catch (error) {
					revokeObjectUrl(previewUrl)
					setAttachedFiles((currentFiles) =>
						currentFiles.map((attachedFile) =>
							attachedFile.id === temporaryId
								? {
										...attachedFile,
										contentUrl: null,
										status: 'failed',
										errorCode:
											error instanceof Error &&
											'errorCode' in error &&
											typeof error.errorCode === 'string'
												? error.errorCode
												: 'FILE_UPLOAD_FAILED',
									}
								: attachedFile
						)
					)
				}
			},
			[registerObjectUrl, revokeObjectUrl]
		)

		const handleSelectFiles = useCallback(
			async (files: FileList | File[] | null) => {
				const selectedFiles = Array.from(files ?? [])
				if (selectedFiles.length === 0) return

				const queuedFiles = selectedFiles.filter((file) => {
					const fingerprint = getUploadFingerprint(file)
					if (uploadingFileFingerprintsRef.current.has(fingerprint)) {
						return false
					}
					uploadingFileFingerprintsRef.current.add(fingerprint)
					return true
				})

				for (
					let index = 0;
					index < queuedFiles.length;
					index += MAX_PARALLEL_UPLOADS
				) {
					const batch = queuedFiles.slice(index, index + MAX_PARALLEL_UPLOADS)
					await Promise.all(
						batch.map(async (file) => {
							try {
								await uploadAttachmentFile(file)
							} finally {
								uploadingFileFingerprintsRef.current.delete(
									getUploadFingerprint(file)
								)
							}
						})
					)
				}

				if (fileInputRef.current) {
					fileInputRef.current.value = ''
				}
			},
			[uploadAttachmentFile]
		)

		const removeAttachedFile = useCallback(
			(fileId: string) => {
				setAttachedFiles((currentFiles) => {
					const fileToRemove = currentFiles.find((file) => file.id === fileId)
					revokeObjectUrl(fileToRemove?.contentUrl)
					return currentFiles.filter((file) => file.id !== fileId)
				})
			},
			[revokeObjectUrl]
		)

		const handleSend = useCallback(async () => {
			if (!message.trim() || disabled) return

			if (isImmediateSend) {
				if (isSubmitCoolingDown) {
					return
				}
				startSubmitCooldown()
			}

			const content = message.trim()
			const readyAttachments: ChatAttachmentInput[] = attachedFiles
				.filter((file) => file.status === 'ready')
				.map((file) => ({
					fileObjectId: file.id,
					kind: file.kind,
					promptUse: file.promptUse,
					filename: file.filename,
					mimeType: file.mimeType,
					sizeBytes: file.sizeBytes,
					status: file.status,
					fileKind: file.fileKind,
					purpose: file.kind === 'image' ? 'vision_image' : 'rag_document',
					contentUrl: file.contentUrl,
				}))
			const sentAttachmentIds = new Set(
				readyAttachments.map((attachment) => attachment.fileObjectId)
			)
			setMessage('') // Clear input immediately for better UX
			setAttachedFiles((currentFiles) =>
				currentFiles.filter((file) => !sentAttachmentIds.has(file.id))
			)

			try {
				const enabledTools: ChatEnabledTool[] = webSearchEnabled
					? ['web.search']
					: []
				if (readyAttachments.length > 0) {
					await onSendMessage(
						content,
						selectedModel.id,
						readyAttachments,
						activeSkills,
						enabledTools
					)
				} else {
					await onSendMessage(
						content,
						selectedModel.id,
						undefined,
						activeSkills,
						enabledTools
					)
				}
				setWebSearchEnabled(false)
			} catch {
				// Restore message if send fails
				setMessage(content)
				setAttachedFiles((currentFiles) => [
					...attachedFiles.filter((file) => file.status === 'ready'),
					...currentFiles,
				])
			}
		}, [
			message,
			selectedModel.id,
			disabled,
			onSendMessage,
			attachedFiles,
			activeSkills,
			webSearchEnabled,
			isImmediateSend,
			isSubmitCoolingDown,
			startSubmitCooldown,
		])

		const handleKeyDown = useCallback(
			(e: KeyboardEvent<HTMLTextAreaElement>) => {
				// Shift+Enter always creates new line
				if (e.key === 'Enter' && e.shiftKey) {
					return
				}

				// Check send keybinding setting
				if (settings.sendKeybinding === 'enter') {
					// Enter sends, Ctrl+Enter creates new line
					if (e.key === 'Enter' && !e.ctrlKey) {
						e.preventDefault()
						handleSend()
					}
				} else {
					// Ctrl+Enter sends, Enter creates new line
					if (e.key === 'Enter' && e.ctrlKey) {
						e.preventDefault()
						handleSend()
					}
				}
			},
			[handleSend, settings.sendKeybinding]
		)

		const handlePaste = useCallback(
			(event: ClipboardEvent<HTMLTextAreaElement>) => {
				const files = getClipboardFiles(event.clipboardData)
				if (files.length === 0) return

				event.preventDefault()
				void handleSelectFiles(files)
			},
			[handleSelectFiles]
		)

		const hasUploadingAttachments = attachedFiles.some(
			(file) => file.status === 'uploading'
		)
		const hasIndexingDocuments = attachedFiles.some(
			(file) =>
				file.kind === 'document' &&
				(file.status === 'uploaded' || file.status === 'processing')
		)
		const hasUnsupportedReadyImages =
			!selectedModelSupportsImages &&
			attachedFiles.some(
				(file) => file.kind === 'image' && file.status === 'ready'
			)
		const isSubmitDisabled =
			disabled ||
			!message.trim() ||
			hasUploadingAttachments ||
			hasIndexingDocuments ||
			hasUnsupportedReadyImages ||
			(isImmediateSend && isSubmitCoolingDown)
		const hasQueue = queuedMessages.length > 0
		const isSelectedReplyContext = branchContext?.kind === 'selected-reply'

		return (
			<>
				<div className="relative w-full">
					{/* Top Pills - Restored from Figma */}
					<div className="flex gap-3 mb-4 px-1">
						{['Create image', 'Thinking', 'Study'].map((label) => (
							<button
								key={label}
								disabled={
									label === 'Create image' &&
									!selectedModelSupportsImageGeneration
								}
								title={
									label === 'Create image' &&
									!selectedModelSupportsImageGeneration
										? 'The selected model does not generate images.'
										: undefined
								}
								className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-card border border-border rounded-full hover:text-primary hover:border-primary/50 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
							>
								{label}
								<ArrowUp className="w-3 h-3 rotate-180 opacity-50" />
							</button>
						))}
					</div>

					{activeSkills.length > 0 ? (
						<div className="mb-3 flex flex-wrap gap-2 px-1">
							{activeSkills.map((skill) => (
								<span
									key={`${skill.installedSkillId}-${skill.scope}`}
									className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary"
								>
									<Sparkles className="h-3 w-3 flex-shrink-0" />
									<span className="truncate">{skill.title}</span>
									<span className="rounded bg-background/50 px-1 text-[10px] text-muted-foreground">
										{skill.scope === 'turn' ? 'once' : 'chat'}
									</span>
									<button
										type="button"
										onClick={() =>
											onRemoveActiveSkill?.(skill.installedSkillId)
										}
										className="rounded p-0.5 hover:bg-primary/20"
										aria-label={`Remove ${skill.title}`}
										title={`Remove ${skill.title}`}
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
						</div>
					) : null}

					<div className="relative flex flex-col w-full bg-[#252525] backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden">
						<input
							ref={fileInputRef}
							type="file"
							multiple
							accept={attachmentAccept}
							className="hidden"
							onChange={(event) =>
								void handleSelectFiles(event.currentTarget.files)
							}
						/>

						{/* Branch Context Banner */}
						{branchContext && (
							<div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
								{isSelectedReplyContext ? (
									<Reply className="w-4 h-4 text-primary" />
								) : (
									<GitBranch className="w-4 h-4 text-primary" />
								)}
								<div className="flex-1 min-w-0">
									<p className="text-xs text-primary font-medium">
										{isSelectedReplyContext
											? 'Replying to selected text'
											: 'Branching from message (editing creates alternative version)'}
									</p>
									<p className="text-xs text-muted-foreground truncate">
										{branchContext.preview}
									</p>
								</div>
								<button
									onClick={onClearBranchContext}
									className="p-1 text-muted-foreground hover:text-primary transition-colors"
									aria-label="Clear branch context"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						)}

						{hasQueue ? (
							<div className="border-b border-border/50 bg-background/30">
								<div className="flex items-center justify-between gap-3 px-4 py-2.5">
									<div className="flex min-w-0 items-center gap-2">
										<ListOrdered className="h-4 w-4 text-primary" />
										<span className="text-xs font-medium text-foreground">
											Queued {queuedMessages.length}
										</span>
										{queueStatus === 'halted' ? (
											<span className="text-[11px] text-destructive">
												Paused after an error
											</span>
										) : (
											<span className="text-[11px] text-muted-foreground">
												{isStreaming
													? 'Waiting for current reply'
													: 'Ready to continue'}
											</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										{queueStatus === 'halted' ? (
											<button
												onClick={onResumeQueue}
												className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
												type="button"
											>
												<Play className="h-3 w-3" />
												Resume
											</button>
										) : null}
										<button
											onClick={onClearQueue}
											className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
											type="button"
										>
											<Trash2 className="h-3 w-3" />
											Clear all
										</button>
									</div>
								</div>
								<div className="max-h-36 overflow-y-auto border-t border-border/40">
									{queuedMessages.map((queuedMessage, index) => (
										<div
											key={queuedMessage.id}
											className="flex items-center gap-3 px-4 py-2 text-xs"
										>
											<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 text-[10px] font-medium text-muted-foreground">
												{index + 1}
											</span>
											<div className="min-w-0 flex-1">
												<p className="truncate text-foreground">
													{queuedMessage.content}
												</p>
												<p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
													{getModelLabel(queuedMessage.model)}
												</p>
											</div>
											<button
												onClick={() =>
													onRemoveQueuedMessage?.(queuedMessage.id)
												}
												className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
												aria-label={`Remove queued message ${index + 1}`}
												type="button"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										</div>
									))}
								</div>
							</div>
						) : null}

						{attachedFiles.length > 0 ? (
							<div className="flex flex-wrap gap-2 border-b border-border/40 px-3 py-2">
								{attachedFiles.map((file) => {
									const isPending =
										file.status === 'uploading' ||
										file.status === 'uploaded' ||
										file.status === 'processing'
									const label =
										file.kind === 'image'
											? file.status === 'ready'
												? selectedModelSupportsImages
													? 'Vision'
													: 'Vision unsupported'
												: file.status === 'failed'
													? 'Failed'
													: 'Uploading'
											: file.status === 'ready'
												? 'Ready'
												: file.status === 'failed'
													? 'Failed'
													: 'Indexing'

									return (
										<div
											key={file.id}
											className="flex max-w-full items-center gap-2 rounded-md border border-border/60 bg-background/30 px-2 py-1 text-xs text-foreground"
										>
											{isPending ? (
												<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
											) : file.kind === 'image' && file.contentUrl ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={file.contentUrl}
													alt=""
													className="h-6 w-6 shrink-0 rounded object-cover"
												/>
											) : file.kind === 'image' ? (
												<ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
											) : (
												<FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
											)}
											<span className="max-w-40 truncate">{file.filename}</span>
											<span
												className={
													file.status === 'failed' ||
													(file.kind === 'image' &&
														file.status === 'ready' &&
														!selectedModelSupportsImages)
														? 'text-destructive'
														: 'text-muted-foreground'
												}
											>
												{label}
											</span>
											<button
												type="button"
												onClick={() => removeAttachedFile(file.id)}
												className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
												aria-label={`Remove ${file.filename}`}
											>
												<X className="h-3 w-3" />
											</button>
										</div>
									)
								})}
							</div>
						) : null}

						{/* Input Field */}
						<textarea
							ref={setTextareaRef}
							value={message}
							onChange={(e) => {
								setMessage(e.target.value)
							}}
							onKeyDown={handleKeyDown}
							onPaste={handlePaste}
							onFocus={onFocus}
							placeholder={
								branchContext
									? isSelectedReplyContext
										? 'Reply about this selection...'
										: 'Continue from this point...'
									: 'Ask anything...'
							}
							className="max-h-56 min-h-[44px] flex-1 resize-none overflow-y-hidden border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
							rows={1}
						/>

						{/* Bottom Actions */}
						<div className="flex items-center justify-between px-3 pb-3">
							<div className="flex items-center gap-1">
								<SkillPicker
									conversationId={conversationId}
									activeSkills={activeSkills}
									onActivateSkill={(skill) => onActivateSkill?.(skill)}
									onRemoveActiveSkill={onRemoveActiveSkill}
								/>
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									disabled={
										!selectedModelSupportsDocumentAttachments &&
										!selectedModelSupportsImages
									}
									title={
										selectedModelSupportsImages
											? 'Attach documents or images'
											: selectedModelSupportsDocumentAttachments
												? 'Attach documents'
												: 'The selected model does not support file attachments.'
									}
									className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
									aria-label="Attach file"
								>
									<Paperclip className="w-4 h-4" />
								</button>
								<button
									type="button"
									onClick={() => setWebSearchEnabled((enabled) => !enabled)}
									title={
										webSearchEnabled
											? 'Web search enabled for this message'
											: 'Search the web for this message'
									}
									aria-label="Toggle web search"
									aria-pressed={webSearchEnabled}
									className={`p-2 rounded-lg transition-colors ${
										webSearchEnabled
											? 'bg-primary/15 text-primary'
											: 'text-muted-foreground hover:text-primary hover:bg-primary/10'
									}`}
								>
									<Globe className="w-4 h-4" />
								</button>
								<button
									type="button"
									disabled={!canUseAudioInput}
									title={
										canUseAudioInput
											? 'Add voice input'
											: selectedModelSupportsAudioInput
												? 'Audio input is not implemented in this chat yet.'
												: 'The selected model does not support audio input.'
									}
									className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
									aria-label="Voice input"
								>
									<Mic className="w-4 h-4" />
								</button>
							</div>

							<div className="flex items-center gap-2">
								{/* Model Selector */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card/50 border border-border/50 rounded-lg hover:text-primary hover:border-primary/50 transition-all">
											<span>{selectedModel.name}</span>
											<ChevronDown className="w-3 h-3" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="end"
										className="w-72 bg-[#0a0d11]/95 backdrop-blur-2xl border-primary/30 shadow-xl"
									>
										{favoriteModels.map((model) => (
											<DropdownMenuItem
												key={model.id}
												onSelect={() => handleSelectModel(model)}
												className="flex items-start gap-3 px-3 py-2.5 cursor-pointer focus:bg-primary/10 focus:text-foreground"
											>
												<Star className="w-4 h-4 mt-0.5 fill-primary text-primary flex-shrink-0" />
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium text-sm">
															{model.name}
														</span>
														{selectedModel.id === model.id && (
															<div className="w-1.5 h-1.5 rounded-full bg-primary" />
														)}
													</div>
													<span className="text-xs text-muted-foreground line-clamp-1">
														{model.description}
													</span>
												</div>
											</DropdownMenuItem>
										))}

										<DropdownMenuSeparator className="bg-primary/20" />

										<DropdownMenuItem
											onSelect={() => setModelsModalOpen(true)}
											className="flex items-center gap-2 px-3 py-2.5 cursor-pointer focus:bg-primary/10 focus:text-foreground"
										>
											<Sparkles className="w-4 h-4 text-muted-foreground" />
											<span className="font-medium text-sm">
												More models...
											</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>

								{isStreaming ? (
									<button
										onClick={onStop}
										className="relative p-2 rounded-lg hover:scale-105 transition-all duration-200 group"
										aria-label="Stop generating"
										title="Stop generating"
										type="button"
									>
										<div className="relative w-8 h-8 flex items-center justify-center">
											<svg
												className="absolute inset-0 w-8 h-8 animate-spin group-hover:opacity-100 transition-opacity"
												viewBox="0 0 32 32"
												fill="none"
											>
												<circle
													cx="16"
													cy="16"
													r="12"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeDasharray="60 20"
													className="text-primary opacity-80 group-hover:opacity-100"
												/>
											</svg>
											<Pause className="w-4 h-4 text-primary z-10 group-hover:scale-110 transition-transform" />
										</div>
									</button>
								) : null}
								<button
									onClick={handleSend}
									className="p-2 rounded-lg bg-primary text-primary-foreground shadow-[0_0_15px_-3px_var(--primary)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={isSubmitDisabled}
									aria-label={isStreaming ? 'Queue message' : 'Send message'}
									title={isStreaming ? 'Queue message' : 'Send message'}
									type="button"
								>
									<ArrowUp className="w-4 h-4" />
								</button>
							</div>
						</div>
					</div>

					<div className="text-center mt-3">
						<p className="text-[10px] text-muted-foreground/40 font-mono tracking-widest uppercase">
							Fork AI Model 0.1
						</p>
					</div>
				</div>

				{/* Models Modal */}
				<ModelsModal
					open={modelsModalOpen}
					onOpenChange={setModelsModalOpen}
					models={models}
					onToggleFavorite={handleToggleFavorite}
					onSelectModel={handleSelectModel}
				/>
			</>
		)
	}
)
