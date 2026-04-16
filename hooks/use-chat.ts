import { fetchConversationDetail } from "@/lib/conversation-api";
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
	createdAt?: Date;
	isStreaming?: boolean;
	parentMessageId?: string | null;
}

export interface MessageHistoryEntry {
	role: Message["role"];
	content: string;
}

function mapMessagesToHistory(messages: Message[]): MessageHistoryEntry[] {
	return messages.map(({ role, content }) => ({ role, content }));
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

	const messageById = new Map(messages.map((message) => [message.id, message]));
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
		.map((line) => (line.startsWith("data: ") ? line.slice(6) : line.slice(5)))
		.join("\n");
}

export interface UseChatOptions {
	conversationId?: string;
	model?: string;
	onConversationCreated?: (conversationId: string) => void;
	onTitleGenerationNeeded?: (conversationId: string) => void;
	onError?: (error: Error) => void;
}

export interface SendMessageResult {
	conversationId: string | null;
	userMessageId: string | null;
	assistantMessageId: string | null;
	status: "done" | "stopped" | "error";
}

export interface UseChatReturn {
	messages: Message[];
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	isStreaming: boolean;
	error: string | null;
	conversationId: string | null;
	sendMessage: (
		content: string,
		model?: string,
		parentMessageId?: string | null,
		history?: MessageHistoryEntry[]
	) => Promise<SendMessageResult>;
	regenerate: (messageId: string) => Promise<void>;
	editAndRegenerate: (messageId: string, newContent: string) => Promise<void>;
	stopGeneration: () => void;
	clearMessages: () => void;
	loadConversation: (conversationId: string) => Promise<void>;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [conversationId, setConversationId] = useState<string | null>(
		options.conversationId || null
	);

	const abortControllerRef = useRef<AbortController | null>(null);
	const messagesRef = useRef<Message[]>(messages);
	const conversationIdRef = useRef<string | null>(conversationId);
	const currentModelRef = useRef<string>(
		options.model || "mistral-large-latest"
	);

	messagesRef.current = messages;
	conversationIdRef.current = conversationId;

	// Store callbacks in refs to avoid dependency issues
	const onConversationCreatedRef = useRef(options.onConversationCreated);
	const onTitleGenerationNeededRef = useRef(options.onTitleGenerationNeeded);
	const onErrorRef = useRef(options.onError);

	// Update refs when options change
	onConversationCreatedRef.current = options.onConversationCreated;
	onTitleGenerationNeededRef.current = options.onTitleGenerationNeeded;
	onErrorRef.current = options.onError;

	// Load an existing conversation
	const loadConversation = useCallback(async (convId: string) => {
		try {
			setError(null);
			const conversation = await fetchConversationDetail(convId);

			setConversationId(convId);
			setMessages(
				conversation.messages.map((msg) => ({
					...msg,
					model: msg.model ?? undefined,
					promptTokens: msg.promptTokens ?? undefined,
					completionTokens: msg.completionTokens ?? undefined,
					isError: msg.isError ?? undefined,
					createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
				}))
			);
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
	}, []);

	// Send a new message
	const sendMessage = useCallback(
		async (
			content: string,
			model?: string,
			parentMessageId?: string | null,
			history?: MessageHistoryEntry[]
		): Promise<SendMessageResult> => {
			if (!content.trim() || isStreaming) {
				return {
					conversationId: conversationIdRef.current,
					userMessageId: null,
					assistantMessageId: null,
					status: "error",
				};
			}

			const selectedModel = model || currentModelRef.current;
			const requestHistory =
				history ?? buildLocalHistorySnapshot(messagesRef.current, parentMessageId);
			currentModelRef.current = selectedModel;

			// Create optimistic user message
			const tempUserMessageId = `temp-user-${Date.now()}`;
			const userMessage: Message = {
				id: tempUserMessageId,
				role: "user",
				content: content.trim(),
				createdAt: new Date(),
				parentMessageId: parentMessageId || null,
			};

			// Create placeholder assistant message - linked to user message
			const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
			const assistantMessage: Message = {
				id: tempAssistantMessageId,
				role: "assistant",
				content: "",
				model: selectedModel,
				isStreaming: true,
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
			let finalStatus: SendMessageResult["status"] = "done";

			try {
				const response = await fetch("/api/chat/stream", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: content.trim(),
						model: selectedModel,
						conversationId: conversationIdRef.current,
						parentMessageId: parentMessageId,
						history: requestHistory,
					}),
					signal: abortControllerRef.current.signal,
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(
						errorData.error || "Failed to send message"
					);
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
								if (typeof data.conversationId !== "string") return;
								setConversationId(data.conversationId);
								conversationIdRef.current = data.conversationId;
								onConversationCreatedRef.current?.(data.conversationId);
								break;

							case "messageId":
								if (typeof data.userMessageId !== "string") return;
								realUserMessageId = data.userMessageId;
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
											msg.parentMessageId === tempUserMessageId
										) {
											return {
												...msg,
												parentMessageId: data.userMessageId,
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
												}
											: msg
									)
								);
								break;

							case "done": {
								const nextAssistantMessageId =
									typeof data.assistantMessageId === "string"
										? data.assistantMessageId
										: null;
								if (nextAssistantMessageId) {
									realAssistantMessageId = nextAssistantMessageId;
								}
								setMessages((prev) => {
									const updatedMessages = prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													id: nextAssistantMessageId ?? msg.id,
													content: accumulatedContent,
													isStreaming: false,
													promptTokens: data.usage?.promptTokens,
													completionTokens:
														data.usage?.completionTokens,
												}
											: msg
									);

									const currentConversationId = conversationIdRef.current;
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
								setError(data.error);
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === tempAssistantMessageId ||
										msg.id === realAssistantMessageId
											? {
													...msg,
													content:
														accumulatedContent ||
														"An error occurred. Please try again.",
													isStreaming: false,
													isError: true,
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
						if (!separatorMatch || separatorMatch.index === undefined) {
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
									}
								: msg
						)
					);
					onErrorRef.current?.(
						err instanceof Error ? err : new Error(errorMessage)
					);
				}
			} finally {
				setIsStreaming(false);
				abortControllerRef.current = null;
			}

			return {
				conversationId: conversationIdRef.current,
				userMessageId: realUserMessageId,
				assistantMessageId: realAssistantMessageId,
				status: finalStatus,
			};
		},
		[isStreaming]
	);

	// Regenerate a failed or errored message by creating a branch
	const regenerate = useCallback(
		async (messageId: string) => {
			// Find the message to regenerate and the previous user message
			const messageIndex = messages.findIndex((m) => m.id === messageId);
			if (messageIndex === -1) return;

			const targetMessage = messages[messageIndex];

			// If it's an assistant message, find the preceding user message
			if (targetMessage.role === "assistant") {
				// Find the last user message before this assistant message
				let userMessage: Message | null = null;
				for (let i = messageIndex - 1; i >= 0; i--) {
					if (messages[i].role === "user") {
						userMessage = messages[i];
						break;
					}
				}

				if (!userMessage) return;

				// Create a sibling assistant message by using the same parent as the original
				// This makes the new response a sibling of the current one
				await sendMessage(
					userMessage.content,
					targetMessage.model,
					targetMessage.parentMessageId,
					buildLocalHistorySnapshot(
						messagesRef.current,
						targetMessage.parentMessageId
					)
				);
			}
		},
		[messages, sendMessage]
	);

	// Stop ongoing generation
	const stopGeneration = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		// Mark streaming message as complete
		setMessages((prev) =>
			prev.map((msg) =>
				msg.isStreaming ? { ...msg, isStreaming: false } : msg
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
	setMessages([]);
	setConversationId(null);
	setError(null);
	setIsStreaming(false);
}, []);

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
