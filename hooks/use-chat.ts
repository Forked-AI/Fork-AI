import {
	cacheConversationDetail,
	clearCachedConversationDetail,
	conversationDetailQueryKey,
	fetchConversationDetail,
	type MessageAttachmentPayload,
	type ConversationDetailPayload,
} from "@/lib/conversation-api";
import type { MessageTrustTrace } from "@/lib/ai/trust-trace";
import { createIdempotencyHeaders } from "@/lib/idempotency-client";
import type {
	ActiveSkillTrace,
	SkillActivationInput,
} from "@/lib/skills/catalog";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

export interface Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	model?: string;
	promptTokens?: number;
	completionTokens?: number;
	isError?: boolean;
	isStopped?: boolean;
	status?:
		| "pending"
		| "streaming"
		| "completed"
		| "failed"
		| "cancelled"
		| "moderated"
		| null;
	errorCode?: string | null;
	providerStatusCode?: number | null;
	providerRequestId?: string | null;
	startedAt?: Date | null;
	completedAt?: Date | null;
	cancelledAt?: Date | null;
	lastChunkAt?: Date | null;
	generationId?: string | null;
	createdAt?: Date;
	isStreaming?: boolean;
	parentMessageId?: string | null;
	citations?: MessageCitation[];
	attachments?: MessageAttachment[];
	activeSkillTrace?: ActiveSkillTrace | null;
	promptSkillHash?: string | null;
	trustTrace?: MessageTrustTrace | null;
	progressStep?: string | null;
}

export interface ChatAttachmentInput {
	fileObjectId: string;
	kind?: "document" | "image";
	promptUse?: "rag" | "vision";
	filename?: string;
	mimeType?: string;
	sizeBytes?: number;
	status?: string;
	fileKind?: string;
	purpose?: string;
	contentUrl?: string | null;
}

export interface MessageAttachment {
	id: string;
	fileObjectId: string;
	kind: "document" | "image";
	promptUse: "rag" | "vision";
	displayOrder: number;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	status: string;
	fileKind: string;
	purpose: string;
	contentUrl?: string | null;
}

export interface MessageHistoryEntry {
	role: "user" | "assistant";
	content: string;
}

export interface MessageCitation {
	index: number;
	chunkId: string;
	fileId: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
}

function isMessageCitation(value: unknown): value is MessageCitation {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { index?: unknown }).index === "number" &&
		typeof (value as { chunkId?: unknown }).chunkId === "string" &&
		typeof (value as { fileId?: unknown }).fileId === "string" &&
		typeof (value as { sourceLabel?: unknown }).sourceLabel === "string"
	);
}

function parseMessageCitations(value: unknown): MessageCitation[] | undefined {
	if (typeof value !== "string" || value.length === 0) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) {
			return undefined;
		}

		const citations = parsed.filter(isMessageCitation);
		return citations.length > 0 ? citations : undefined;
	} catch {
		return undefined;
	}
}

function mapMessagesToHistory(messages: Message[]): MessageHistoryEntry[] {
	return messages
		.filter(
			(message): message is Message & { role: "user" | "assistant" } =>
				message.role === "user" || message.role === "assistant"
		)
		.map(({ role, content }) => ({ role, content }));
}

function mapAttachmentPayload(
	attachment: MessageAttachmentPayload
): MessageAttachment {
	return {
		id: attachment.id,
		fileObjectId: attachment.fileObjectId,
		kind: attachment.kind,
		promptUse: attachment.promptUse,
		displayOrder: attachment.displayOrder,
		filename: attachment.fileObject.filename,
		mimeType: attachment.fileObject.mimeType,
		sizeBytes: attachment.fileObject.sizeBytes,
		status: attachment.fileObject.status,
		fileKind: attachment.fileObject.kind,
		purpose: attachment.fileObject.purpose,
		contentUrl:
			attachment.kind === "image"
				? `/api/attachments/${attachment.fileObjectId}/content`
				: null,
	};
}

function mapAttachmentInput(
	attachment: ChatAttachmentInput,
	index: number
): MessageAttachment {
	const kind = attachment.kind ?? "document";
	return {
		id: `temp-attachment-${attachment.fileObjectId}`,
		fileObjectId: attachment.fileObjectId,
		kind,
		promptUse:
			attachment.promptUse ?? (kind === "image" ? "vision" : "rag"),
		displayOrder: index,
		filename: attachment.filename ?? "Attachment",
		mimeType: attachment.mimeType ?? "application/octet-stream",
		sizeBytes: attachment.sizeBytes ?? 0,
		status: attachment.status ?? "ready",
		fileKind: attachment.fileKind ?? (kind === "image" ? "image" : "text"),
		purpose:
			attachment.purpose ??
			(kind === "image" ? "vision_image" : "rag_document"),
		contentUrl:
			attachment.contentUrl ??
			(kind === "image"
				? `/api/attachments/${attachment.fileObjectId}/content`
				: null),
	};
}

function mapConversationDetailMessages(
	conversation: ConversationDetailPayload
): Message[] {
	return conversation.messages.map((msg) => ({
		...msg,
		model: msg.model ?? undefined,
		promptTokens: msg.promptTokens ?? undefined,
		completionTokens: msg.completionTokens ?? undefined,
		status: msg.status ?? undefined,
		isError:
			msg.status === "failed" || msg.status === "moderated"
				? true
				: (msg.isError ?? undefined),
		isStopped: msg.status === "cancelled" ? true : undefined,
		isStreaming:
			msg.status === "pending" || msg.status === "streaming"
				? true
				: undefined,
		errorCode: msg.errorCode ?? undefined,
		providerStatusCode: msg.providerStatusCode ?? undefined,
		providerRequestId: msg.providerRequestId ?? undefined,
		startedAt: msg.startedAt ? new Date(msg.startedAt) : undefined,
		completedAt: msg.completedAt ? new Date(msg.completedAt) : undefined,
		cancelledAt: msg.cancelledAt ? new Date(msg.cancelledAt) : undefined,
		lastChunkAt: msg.lastChunkAt ? new Date(msg.lastChunkAt) : undefined,
		createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
		citations: parseMessageCitations(msg.ragCitationData),
		attachments: msg.attachments?.map(mapAttachmentPayload),
		activeSkillTrace: isActiveSkillTrace(msg.activeSkillTraceJson)
			? msg.activeSkillTraceJson
			: null,
		promptSkillHash: msg.promptSkillHash ?? null,
		trustTrace: msg.trustTrace ?? null,
	}));
}

function isActiveSkillTrace(value: unknown): value is ActiveSkillTrace {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as { items?: unknown }).items) &&
		typeof (value as { renderHash?: unknown }).renderHash === "string"
	);
}

export function buildLocalHistorySnapshot(
	messages: Message[],
	parentMessageId?: string | null
): MessageHistoryEntry[] {
	if (!parentMessageId) {
		return mapMessagesToHistory(
			[...messages].sort((a, b) => {
				const aTime = a.createdAt?.getTime() ?? 0;
				const bTime = b.createdAt?.getTime() ?? 0;
				return aTime - bTime;
			})
		);
	}

	const messageById = new Map(
		messages.map((message) => [message.id, message])
	);
	const path: Message[] = [];
	let currentId: string | null = parentMessageId;

	while (currentId) {
		const currentMessage = messageById.get(currentId);
		if (!currentMessage) break;
		path.unshift(currentMessage);
		currentId = currentMessage.parentMessageId ?? null;
	}

	return mapMessagesToHistory(path);
}

function extractSsePayload(rawEvent: string): string | null {
	const dataLines = rawEvent
		.split(/\r?\n/)
		.filter((line) => line.startsWith("data:"));

	if (dataLines.length === 0) return null;

	return dataLines
		.map((line) =>
			line.startsWith("data: ") ? line.slice(6) : line.slice(5)
		)
		.join("\n");
}

function parseRetryAfterSeconds(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return Math.ceil(value);
	}

	if (typeof value === "string") {
		const asNumber = Number(value);
		if (Number.isFinite(asNumber) && asNumber >= 0) {
			return Math.ceil(asNumber);
		}

		const asDateMs = Date.parse(value);
		if (!Number.isNaN(asDateMs)) {
			return Math.max(0, Math.ceil((asDateMs - Date.now()) / 1000));
		}
	}

	return null;
}

function formatRetryWindow(seconds: number | null): string {
	if (seconds === null) {
		return "in a moment";
	}

	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.ceil(seconds / 60);
	return `${minutes}m`;
}

function buildRateLimitMessage(
	scope: "provider" | "chat",
	retryAfterSeconds: number | null
): string {
	const baseMessage =
		scope === "provider"
			? "Model is currently rate-limited."
			: "Chat rate limit reached.";

	return `${baseMessage} Please retry in ${formatRetryWindow(retryAfterSeconds)}.`;
}

function buildHttpErrorMessage(response: Response, errorData: unknown): string {
	const parsedError =
		typeof errorData === "object" && errorData !== null
			? (errorData as {
					error?: unknown;
					errorCode?: unknown;
					retryAfter?: unknown;
					retryAfterSeconds?: unknown;
				})
			: {};

	if (response.status === 429) {
		const retryAfterSeconds =
			parseRetryAfterSeconds(parsedError.retryAfterSeconds) ??
			parseRetryAfterSeconds(parsedError.retryAfter) ??
			parseRetryAfterSeconds(response.headers.get("retry-after"));

		if (parsedError.errorCode === "CHAT_RATE_LIMIT_EXCEEDED") {
			return buildRateLimitMessage("chat", retryAfterSeconds);
		}

		return buildRateLimitMessage("provider", retryAfterSeconds);
	}

	if (typeof parsedError.error === "string" && parsedError.error.length > 0) {
		return parsedError.error;
	}

	return "Failed to send message";
}

function buildStreamErrorMessage(payload: unknown): string {
	if (typeof payload !== "object" || payload === null) {
		return "Stream interrupted. You can retry this message.";
	}

	const parsedPayload = payload as {
		error?: unknown;
		errorCode?: unknown;
		providerStatusCode?: unknown;
		retryAfterSeconds?: unknown;
		retryAfter?: unknown;
	};

	if (
		parsedPayload.errorCode === "PROVIDER_RATE_LIMITED" ||
		parsedPayload.providerStatusCode === 429
	) {
		const retryAfterSeconds =
			parseRetryAfterSeconds(parsedPayload.retryAfterSeconds) ??
			parseRetryAfterSeconds(parsedPayload.retryAfter);
		return buildRateLimitMessage("provider", retryAfterSeconds);
	}

	if (parsedPayload.errorCode === "CHAT_RATE_LIMIT_EXCEEDED") {
		const retryAfterSeconds =
			parseRetryAfterSeconds(parsedPayload.retryAfterSeconds) ??
			parseRetryAfterSeconds(parsedPayload.retryAfter);
		return buildRateLimitMessage("chat", retryAfterSeconds);
	}

	if (
		typeof parsedPayload.error === "string" &&
		parsedPayload.error.length > 0
	) {
		return parsedPayload.error;
	}

	return "Stream interrupted. You can retry this message.";
}

export interface UseChatOptions {
	conversationId?: string;
	model?: string;
	systemPrompt?: string;
	onConversationCreated?: (_conversationId: string) => void;
	onTitleGenerationNeeded?: (_conversationId: string) => void;
	onError?: (_error: Error) => void;
}

export interface SendMessageResult {
	conversationId: string | null;
	userMessageId: string | null;
	assistantMessageId: string | null;
	status: "done" | "stopped" | "error";
}

export type ChatEnabledTool = "web.search";

export interface UseChatReturn {
	messages: Message[];
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	isStreaming: boolean;
	error: string | null;
	conversationId: string | null;
	sendMessage: (
		_content: string,
		_model?: string,
		_parentMessageId?: string | null,
		_history?: MessageHistoryEntry[],
		_ragFileIds?: string[],
		_attachments?: ChatAttachmentInput[],
		_activeSkills?: SkillActivationInput[],
		_enabledTools?: ChatEnabledTool[]
	) => Promise<SendMessageResult>;
	regenerate: (_messageId: string) => Promise<void>;
	editAndRegenerate: (
		_messageId: string,
		_newContent: string
	) => Promise<void>;
	stopGeneration: () => void;
	clearMessages: () => void;
	loadConversation: (_conversationId: string) => Promise<void>;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
	const queryClient = useQueryClient();
	const [messages, setMessages] = useState<Message[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [conversationId, setConversationId] = useState<string | null>(
		options.conversationId || null
	);

	const abortControllerRef = useRef<AbortController | null>(null);
	const inFlightSendRef = useRef(false);
	const activeAssistantMessageIdRef = useRef<string | null>(null);
	const activeGenerationIdRef = useRef<string | null>(null);
	const messagesRef = useRef<Message[]>(messages);
	const conversationIdRef = useRef<string | null>(conversationId);
	const currentModelRef = useRef<string>(
		options.model || "mistral-large-latest"
	);
	const systemPromptRef = useRef(options.systemPrompt ?? "");

	messagesRef.current = messages;
	conversationIdRef.current = conversationId;
	systemPromptRef.current = options.systemPrompt ?? "";

	// Store callbacks in refs to avoid dependency issues
	const onConversationCreatedRef = useRef(options.onConversationCreated);
	const onTitleGenerationNeededRef = useRef(options.onTitleGenerationNeeded);
	const onErrorRef = useRef(options.onError);

	// Update refs when options change
	onConversationCreatedRef.current = options.onConversationCreated;
	onTitleGenerationNeededRef.current = options.onTitleGenerationNeeded;
	onErrorRef.current = options.onError;

	const clearConversationCaches = useCallback(
		(nextConversationId: string | null) => {
			if (!nextConversationId) return;
			clearCachedConversationDetail(nextConversationId);
			queryClient.removeQueries({
				queryKey: conversationDetailQueryKey(nextConversationId),
				exact: true,
			});
		},
		[queryClient]
	);

	// Load an existing conversation
	const loadConversation = useCallback(
		async (convId: string) => {
			try {
				setError(null);
				const queryKey = conversationDetailQueryKey(convId);
				let conversation =
					queryClient.getQueryData<ConversationDetailPayload>(
						queryKey
					);

				if (!conversation) {
					conversation = await fetchConversationDetail(convId);
				}

				cacheConversationDetail(conversation);
				queryClient.setQueryData(queryKey, conversation);
				setConversationId(convId);
				setMessages(mapConversationDetailMessages(conversation));
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.message
						: "Failed to load conversation";
				setError(errorMessage);
				onErrorRef.current?.(
					err instanceof Error ? err : new Error(errorMessage)
				);
			}
		},
		[queryClient]
	);

	// Send a new message
	const sendMessage = useCallback(
		async (
			content: string,
			model?: string,
			parentMessageId?: string | null,
			history?: MessageHistoryEntry[],
			ragFileIds?: string[],
			attachments?: ChatAttachmentInput[],
			activeSkills?: SkillActivationInput[],
			enabledTools?: ChatEnabledTool[]
		): Promise<SendMessageResult> => {
			if (!content.trim() || inFlightSendRef.current || isStreaming) {
				return {
					conversationId: conversationIdRef.current,
					userMessageId: null,
					assistantMessageId: null,
					status: "error",
				};
			}

			inFlightSendRef.current = true;

			clearConversationCaches(conversationIdRef.current);

			const selectedModel = model || currentModelRef.current;
			const requestHistory =
				history ??
				buildLocalHistorySnapshot(messagesRef.current, parentMessageId);
			currentModelRef.current = selectedModel;

			// Create optimistic user message
			const tempUserMessageId = `temp-user-${Date.now()}`;
			const userMessage: Message = {
				id: tempUserMessageId,
				role: "user",
				content: content.trim(),
				createdAt: new Date(),
				parentMessageId: parentMessageId || null,
				attachments: attachments?.map(mapAttachmentInput),
			};

			// Create placeholder assistant message - linked to user message
			const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
			const assistantMessage: Message = {
				id: tempAssistantMessageId,
				role: "assistant",
				content: "",
				model: selectedModel,
				isStreaming: true,
				status: "streaming",
				createdAt: new Date(),
				parentMessageId: tempUserMessageId, // Link to user message
			};

			setMessages((prev) => [...prev, userMessage, assistantMessage]);
			setIsStreaming(true);
			setError(null);

			// Create abort controller for this request
			abortControllerRef.current = new AbortController();

			// Declare these outside try block so they're accessible in catch
			let accumulatedContent = "";
			let realUserMessageId = tempUserMessageId;
			let realAssistantMessageId = tempAssistantMessageId;
			let realGenerationId: string | null = null;
			let finalStatus: SendMessageResult["status"] = "done";
			activeAssistantMessageIdRef.current = realAssistantMessageId;
			activeGenerationIdRef.current = null;

			try {
				const response = await fetch("/api/chat/stream", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...createIdempotencyHeaders("chat"),
					},
					body: JSON.stringify({
						message: content.trim(),
						model: selectedModel,
						conversationId: conversationIdRef.current,
						parentMessageId: parentMessageId,
						ragFileIds,
						attachments: attachments?.map((attachment) => ({
							fileObjectId: attachment.fileObjectId,
						})),
						history: requestHistory,
						systemPrompt: systemPromptRef.current,
						activeSkills,
						enabledTools,
					}),
					signal: abortControllerRef.current.signal,
				});

				if (!response.ok) {
					let errorData: unknown = null;
					try {
						errorData = await response.json();
					} catch {
						errorData = null;
					}

					throw new Error(buildHttpErrorMessage(response, errorData));
				}

				const reader = response.body?.getReader();
				if (!reader) throw new Error("No response body");

				const decoder = new TextDecoder();
				let buffer = "";

				const handleStreamEvent = (jsonStr: string) => {
					if (!jsonStr || jsonStr === "[DONE]") return;

					try {
						const data = JSON.parse(jsonStr);

						switch (data.type) {
							case "conversation":
								if (typeof data.conversationId !== "string")
									return;
								setConversationId(data.conversationId);
								conversationIdRef.current = data.conversationId;
								clearConversationCaches(data.conversationId);
								onConversationCreatedRef.current?.(
									data.conversationId
								);
								break;

							case "messageId":
								if (typeof data.userMessageId !== "string")
									return;
								realUserMessageId = data.userMessageId;
								if (
									typeof data.assistantMessageId === "string"
								) {
									realAssistantMessageId =
										data.assistantMessageId;
									activeAssistantMessageIdRef.current =
										data.assistantMessageId;
								}
								if (typeof data.generationId === "string") {
									realGenerationId = data.generationId;
									activeGenerationIdRef.current =
										data.generationId;
								}
								const activeSkillTrace = isActiveSkillTrace(
									data.activeSkillTrace
								)
									? data.activeSkillTrace
									: null;
								setMessages((prev) =>
									prev.map((msg) => {
										if (msg.id === tempUserMessageId) {
											return {
												...msg,
												id: data.userMessageId,
											};
										}
										if (
											msg.id === tempAssistantMessageId &&
											msg.parentMessageId ===
												tempUserMessageId
										) {
											return {
												...msg,
												id: realAssistantMessageId,
												parentMessageId:
													data.userMessageId,
												generationId: realGenerationId,
												activeSkillTrace,
												promptSkillHash:
													activeSkillTrace?.renderHash ??
													null,
											};
										}
										return msg;
									})
								);
								break;

							case "content":
								if (typeof data.content !== "string") return;
								accumulatedContent += data.content;
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													content: accumulatedContent,
													status: "streaming",
												}
											: msg
									)
								);
								break;

							case "citations": {
								const citations = Array.isArray(data.citations)
									? data.citations.filter(isMessageCitation)
									: [];
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													citations,
												}
											: msg
									)
								);
								break;
							}

							case "progress": {
								if (typeof data.step !== "string") return;
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													progressStep: data.step,
												}
											: msg
									)
								);
								break;
							}

							case "done": {
								const nextAssistantMessageId =
									typeof data.assistantMessageId === "string"
										? data.assistantMessageId
										: null;
								if (nextAssistantMessageId) {
									realAssistantMessageId =
										nextAssistantMessageId;
								}
								setMessages((prev) => {
									const updatedMessages: Message[] = prev.map(
										(msg) =>
											msg.id === tempAssistantMessageId ||
											msg.id === realAssistantMessageId
												? {
														...msg,
														id:
															nextAssistantMessageId ??
															msg.id,
														content:
															accumulatedContent,
														isStreaming: false,
														status: "completed",
														promptTokens:
															data.usage
																?.promptTokens,
														completionTokens:
															data.usage
																?.completionTokens,
														progressStep: null,
													}
												: msg
									);

									const currentConversationId =
										conversationIdRef.current;
									if (
										updatedMessages.length === 4 &&
										currentConversationId
									) {
										onTitleGenerationNeededRef.current?.(
											currentConversationId
										);
									}

									return updatedMessages;
								});
								break;
							}

							case "error":
								finalStatus = "error";
								const streamErrorMessage =
									buildStreamErrorMessage(data);
								const replacementContent =
									data.errorCode === "OUTPUT_MODERATED" &&
									typeof data.replacementContent === "string"
										? data.replacementContent
										: null;
								setError(streamErrorMessage);
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													content:
														replacementContent ||
														accumulatedContent ||
														streamErrorMessage,
													isStreaming: false,
													isError: true,
													status:
														data.errorCode ===
														"OUTPUT_MODERATED"
															? "moderated"
															: "failed",
													errorCode:
														typeof data.errorCode ===
														"string"
															? data.errorCode
															: undefined,
												}
											: msg
									)
								);
								break;
						}
					} catch {
						// Ignore JSON parse errors until a full SSE event is available.
					}
				};

				const flushCompleteEvents = () => {
					while (true) {
						const separatorMatch = buffer.match(/\r?\n\r?\n/);
						if (
							!separatorMatch ||
							separatorMatch.index === undefined
						) {
							return;
						}

						const rawEvent = buffer.slice(0, separatorMatch.index);
						buffer = buffer.slice(
							separatorMatch.index + separatorMatch[0].length
						);

						const payload = extractSsePayload(rawEvent);
						if (payload) {
							handleStreamEvent(payload);
						}
					}
				};

				while (true) {
					const { done, value } = await reader.read();
					buffer += decoder.decode(value ?? new Uint8Array(), {
						stream: !done,
					});
					flushCompleteEvents();
					if (done) break;
				}

				buffer += decoder.decode();
				const finalPayload = extractSsePayload(buffer);
				if (finalPayload) {
					handleStreamEvent(finalPayload);
				}
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					finalStatus = "stopped";
					// Request was cancelled - keep accumulated content and mark as stopped
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === tempAssistantMessageId
								? {
										...msg,
										content:
											accumulatedContent || msg.content,
										isStreaming: false,
										isStopped: true,
										status: "cancelled",
									}
								: msg
						)
					);
				} else {
					finalStatus = "error";
					const errorMessage =
						err instanceof Error
							? err.message
							: "Failed to send message";
					setError(errorMessage);
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === tempAssistantMessageId
								? {
										...msg,
										content: errorMessage,
										isStreaming: false,
										isError: true,
										status: "failed",
									}
								: msg
						)
					);
					onErrorRef.current?.(
						err instanceof Error ? err : new Error(errorMessage)
					);
				}
			} finally {
				clearConversationCaches(conversationIdRef.current);
				setIsStreaming(false);
				inFlightSendRef.current = false;
				abortControllerRef.current = null;
				activeAssistantMessageIdRef.current = null;
				activeGenerationIdRef.current = null;
			}

			return {
				conversationId: conversationIdRef.current,
				userMessageId: realUserMessageId,
				assistantMessageId: realAssistantMessageId,
				status: finalStatus,
			};
		},
		[isStreaming, clearConversationCaches]
	);

	// Regenerate a failed or errored message by creating a branch
	const regenerate = useCallback(
		async (messageId: string) => {
			// Find the message to regenerate and the previous user message
			const messageIndex = messages.findIndex((m) => m.id === messageId);
			if (messageIndex === -1) return;

			const targetMessage = messages[messageIndex];

			if (
				targetMessage.role !== "assistant" ||
				inFlightSendRef.current ||
				isStreaming
			) {
				return;
			}

			inFlightSendRef.current = true;
			clearConversationCaches(conversationIdRef.current);

			const selectedModel =
				targetMessage.model || currentModelRef.current;
			const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
			const retryMessage: Message = {
				id: tempAssistantMessageId,
				role: "assistant",
				content: "",
				model: selectedModel,
				isStreaming: true,
				status: "streaming",
				createdAt: new Date(),
				parentMessageId: targetMessage.parentMessageId ?? null,
			};

			setMessages((prev) => [...prev, retryMessage]);
			setIsStreaming(true);
			setError(null);

			abortControllerRef.current = new AbortController();
			let accumulatedContent = "";
			let realAssistantMessageId = tempAssistantMessageId;
			let realGenerationId: string | null = null;
			activeAssistantMessageIdRef.current = realAssistantMessageId;
			activeGenerationIdRef.current = null;

			try {
				const response = await fetch(
					`/api/messages/${targetMessage.id}/retry`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...createIdempotencyHeaders("retry-generation"),
						},
						body: JSON.stringify({
							model: selectedModel,
							systemPrompt: systemPromptRef.current,
						}),
						signal: abortControllerRef.current.signal,
					}
				);

				if (!response.ok) {
					let errorData: unknown = null;
					try {
						errorData = await response.json();
					} catch {
						errorData = null;
					}

					throw new Error(buildHttpErrorMessage(response, errorData));
				}

				const reader = response.body?.getReader();
				if (!reader) throw new Error("No response body");

				const decoder = new TextDecoder();
				let buffer = "";

				const handleStreamEvent = (jsonStr: string) => {
					if (!jsonStr || jsonStr === "[DONE]") return;

					try {
						const data = JSON.parse(jsonStr);

						switch (data.type) {
							case "messageId":
								if (
									typeof data.assistantMessageId === "string"
								) {
									realAssistantMessageId =
										data.assistantMessageId;
									activeAssistantMessageIdRef.current =
										data.assistantMessageId;
								}
								if (typeof data.generationId === "string") {
									realGenerationId = data.generationId;
									activeGenerationIdRef.current =
										data.generationId;
								}
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													id: realAssistantMessageId,
													parentMessageId:
														typeof data.userMessageId ===
														"string"
															? data.userMessageId
															: msg.parentMessageId,
													generationId:
														realGenerationId,
												}
											: msg
									)
								);
								break;

							case "content":
								if (typeof data.content !== "string") return;
								accumulatedContent += data.content;
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													content: accumulatedContent,
													status: "streaming",
												}
											: msg
									)
								);
								break;

							case "done":
								if (
									typeof data.assistantMessageId === "string"
								) {
									realAssistantMessageId =
										data.assistantMessageId;
								}
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													id:
														typeof data.assistantMessageId ===
														"string"
															? data.assistantMessageId
															: msg.id,
													content: accumulatedContent,
													isStreaming: false,
													status: "completed",
													promptTokens:
														data.usage
															?.promptTokens,
													completionTokens:
														data.usage
															?.completionTokens,
												}
											: msg
									)
								);
								break;

							case "error": {
								const streamErrorMessage =
									buildStreamErrorMessage(data);
								const replacementContent =
									data.errorCode === "OUTPUT_MODERATED" &&
									typeof data.replacementContent === "string"
										? data.replacementContent
										: null;
								setError(streamErrorMessage);
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													content:
														replacementContent ||
														accumulatedContent ||
														streamErrorMessage,
													isStreaming: false,
													isError: true,
													status:
														data.errorCode ===
														"OUTPUT_MODERATED"
															? "moderated"
															: data.errorCode ===
																  "GENERATION_CANCELLED"
																? "cancelled"
																: "failed",
													errorCode:
														typeof data.errorCode ===
														"string"
															? data.errorCode
															: undefined,
												}
											: msg
									)
								);
								break;
							}
						}
					} catch {
						// Ignore partial JSON events until a complete SSE block arrives.
					}
				};

				const flushCompleteEvents = () => {
					while (true) {
						const separatorMatch = buffer.match(/\r?\n\r?\n/);
						if (
							!separatorMatch ||
							separatorMatch.index === undefined
						) {
							return;
						}

						const rawEvent = buffer.slice(0, separatorMatch.index);
						buffer = buffer.slice(
							separatorMatch.index + separatorMatch[0].length
						);

						const payload = extractSsePayload(rawEvent);
						if (payload) {
							handleStreamEvent(payload);
						}
					}
				};

				while (true) {
					const { done, value } = await reader.read();
					buffer += decoder.decode(value ?? new Uint8Array(), {
						stream: !done,
					});
					flushCompleteEvents();
					if (done) break;
				}

				buffer += decoder.decode();
				const finalPayload = extractSsePayload(buffer);
				if (finalPayload) {
					handleStreamEvent(finalPayload);
				}
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === tempAssistantMessageId ||
							msg.id === realAssistantMessageId
								? {
										...msg,
										content:
											accumulatedContent || msg.content,
										isStreaming: false,
										isStopped: true,
										status: "cancelled",
									}
								: msg
						)
					);
				} else {
					const errorMessage =
						err instanceof Error
							? err.message
							: "Failed to retry message";
					setError(errorMessage);
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === tempAssistantMessageId ||
							msg.id === realAssistantMessageId
								? {
										...msg,
										content: errorMessage,
										isStreaming: false,
										isError: true,
										status: "failed",
									}
								: msg
						)
					);
					onErrorRef.current?.(
						err instanceof Error ? err : new Error(errorMessage)
					);
				}
			} finally {
				clearConversationCaches(conversationIdRef.current);
				setIsStreaming(false);
				inFlightSendRef.current = false;
				abortControllerRef.current = null;
				activeAssistantMessageIdRef.current = null;
				activeGenerationIdRef.current = null;
			}
		},
		[messages, isStreaming, clearConversationCaches]
	);

	// Stop ongoing generation
	const stopGeneration = useCallback(() => {
		const abortLocalRequest = () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
				abortControllerRef.current = null;
			}
		};
		const assistantMessageId = activeAssistantMessageIdRef.current;
		if (
			assistantMessageId &&
			!assistantMessageId.startsWith("temp-assistant-")
		) {
			void fetch(`/api/messages/${assistantMessageId}/cancel`, {
				method: "POST",
				headers: createIdempotencyHeaders("cancel-generation"),
			}).finally(abortLocalRequest);
		} else {
			abortLocalRequest();
		}
		inFlightSendRef.current = false;
		// Mark streaming message as complete
		setMessages((prev) =>
			prev.map((msg) =>
				msg.isStreaming
					? {
							...msg,
							isStreaming: false,
							isStopped: true,
							status: "cancelled",
						}
					: msg
			)
		);
		setIsStreaming(false);
	}, []);

	// Edit a user message and regenerate from that point
	const editAndRegenerate = useCallback(
		async (messageId: string, newContent: string) => {
			if (!newContent.trim() || isStreaming) return;

			// Find the message index
			const messageIndex = messages.findIndex((m) => m.id === messageId);
			if (messageIndex === -1) return;

			const targetMessage = messages[messageIndex];
			if (targetMessage.role !== "user") return;

			// Get the model from the following assistant message, if any
			let modelToUse = currentModelRef.current;
			if (
				messageIndex + 1 < messages.length &&
				messages[messageIndex + 1].role === "assistant"
			) {
				modelToUse = messages[messageIndex + 1].model || modelToUse;
			}

			// Create a sibling branch instead of deleting messages (non-destructive edit)
			// This preserves the original message and all subsequent messages in the tree
			await sendMessage(
				newContent.trim(),
				modelToUse,
				targetMessage.parentMessageId,
				buildLocalHistorySnapshot(
					messagesRef.current,
					targetMessage.parentMessageId
				)
			);
		},
		[messages, sendMessage, isStreaming]
	);

	// Clear all messages
	const clearMessages = useCallback(() => {
		if (conversationIdRef.current) {
			clearCachedConversationDetail(conversationIdRef.current);
			queryClient.removeQueries({
				queryKey: conversationDetailQueryKey(conversationIdRef.current),
				exact: true,
			});
		}
		setMessages([]);
		setConversationId(null);
		setError(null);
		setIsStreaming(false);
		inFlightSendRef.current = false;
	}, [queryClient]);

	return {
		messages,
		setMessages,
		isStreaming,
		error,
		conversationId,
		sendMessage,
		regenerate,
		editAndRegenerate,
		stopGeneration,
		clearMessages,
		loadConversation,
	};
}
