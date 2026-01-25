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
}

export interface UseChatOptions {
  conversationId?: string;
  model?: string;
  onConversationCreated?: (conversationId: string) => void;
  onTitleGenerationNeeded?: (conversationId: string) => void;
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isStreaming: boolean;
  error: string | null;
  conversationId: string | null;
  sendMessage: (content: string, model?: string) => Promise<void>;
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
  const currentModelRef = useRef<string>(options.model || "mistral-large-latest");
  
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
      const response = await fetch(`/api/conversations/${convId}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load conversation");
      }

      const { conversation } = await response.json();
      
      setConversationId(convId);
      setMessages(
        conversation.messages.map((msg: Message) => ({
          ...msg,
          createdAt: new Date(msg.createdAt!),
        }))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load conversation";
      setError(errorMessage);
      onErrorRef.current?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, []);

  // Send a new message
  const sendMessage = useCallback(
    async (content: string, model?: string) => {
      if (!content.trim() || isStreaming) return;

      const selectedModel = model || currentModelRef.current;
      currentModelRef.current = selectedModel;

      // Create optimistic user message
      const tempUserMessageId = `temp-user-${Date.now()}`;
      const userMessage: Message = {
        id: tempUserMessageId,
        role: "user",
        content: content.trim(),
        createdAt: new Date(),
      };

      // Create placeholder assistant message
      const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: tempAssistantMessageId,
        role: "assistant",
        content: "",
        model: selectedModel,
        isStreaming: true,
        createdAt: new Date(),
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

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
            model: selectedModel,
            conversationId: conversationId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to send message");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);

              switch (data.type) {
                case "conversation":
                  // New conversation created
                  setConversationId(data.conversationId);
                  onConversationCreatedRef.current?.(data.conversationId);
                  break;

                case "messageId":
                  // Update user message with real ID
                  realUserMessageId = data.userMessageId;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempUserMessageId
                        ? { ...msg, id: data.userMessageId }
                        : msg
                    )
                  );
                  break;

                case "content":
                  // Stream content chunk
                  accumulatedContent += data.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantMessageId || msg.id === realAssistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                  break;

                case "done":
                  // Stream complete
                  realAssistantMessageId = data.assistantMessageId;
                  setMessages((prev) => {
                    const updatedMessages = prev.map((msg) =>
                      msg.id === tempAssistantMessageId
                        ? {
                            ...msg,
                            id: data.assistantMessageId,
                            content: accumulatedContent,
                            isStreaming: false,
                            promptTokens: data.usage?.promptTokens,
                            completionTokens: data.usage?.completionTokens,
                          }
                        : msg
                    );
                    
                    // Trigger title generation after 3rd message (first full exchange + start of 2nd)
                    // This gives AI enough context to generate a meaningful title
                    if (updatedMessages.length === 4 && conversationId) {
                      onTitleGenerationNeededRef.current?.(conversationId);
                    }
                    
                    return updatedMessages;
                  });
                  break;

                case "error":
                  // Handle stream error
                  setError(data.error);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantMessageId || msg.id === realAssistantMessageId
                        ? {
                            ...msg,
                            content: accumulatedContent || "An error occurred. Please try again.",
                            isStreaming: false,
                            isError: true,
                          }
                        : msg
                    )
                  );
                  break;
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled - keep accumulated content and mark as stopped
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantMessageId
                ? { ...msg, content: accumulatedContent || msg.content, isStreaming: false, isStopped: true }
                : msg
            )
          );
        } else {
          const errorMessage = err instanceof Error ? err.message : "Failed to send message";
          setError(errorMessage);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantMessageId
                ? { ...msg, content: errorMessage, isStreaming: false, isError: true }
                : msg
            )
          );
          onErrorRef.current?.(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [conversationId, isStreaming]
  );

  // Regenerate a failed or errored message
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
        let userMessageId: string | null = null;
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            userMessage = messages[i];
            userMessageId = messages[i].id;
            break;
          }
        }

        if (!userMessage || !userMessageId) return;

        // Remove both the user message and the errored assistant message
        // sendMessage will re-add them
        setMessages((prev) => prev.filter((m) => m.id !== messageId && m.id !== userMessageId));

        // Resend the user message
        await sendMessage(userMessage.content, targetMessage.model);
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
      if (messageIndex + 1 < messages.length && messages[messageIndex + 1].role === "assistant") {
        modelToUse = messages[messageIndex + 1].model || modelToUse;
      }
      
      // Remove this message and all messages after it
      setMessages((prev) => prev.slice(0, messageIndex));
      
      // Send the edited message
      await sendMessage(newContent.trim(), modelToUse);
    },
    [messages, sendMessage, isStreaming]
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
