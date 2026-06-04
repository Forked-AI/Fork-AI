import {
	buildProviderMessages,
	type ConversationMessage,
	type ProviderMessage,
} from "@/lib/chat-system-prompt";

export interface ChatContextInput {
	appSystemPrompt: string;
	userCustomInstructions: string;
	messageHistory: ConversationMessage[];
}

export function buildChatProviderMessages(
	input: ChatContextInput
): ProviderMessage[] {
	return buildProviderMessages(
		input.appSystemPrompt,
		input.userCustomInstructions,
		input.messageHistory
	);
}
