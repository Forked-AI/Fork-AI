import { prisma } from "@/lib/prisma";
import { retrieveDocumentContext } from "@/lib/rag/retrieval";
import { searchWeb } from "@/lib/search";
import { WebSearchUnavailableError } from "@/lib/search/provider";
import { ToolExecutionError } from "@/lib/tools/errors";
import { truncateText, toToolJsonValue } from "@/lib/tools/sanitizer";
import type {
	ToolDefinition,
	ToolExecutionContext,
	ToolRegistry,
} from "@/lib/tools/types";
import { z } from "zod";

const ragRetrieveInputSchema = z.object({
	query: z.string().trim().min(1).max(4_000),
	fileIds: z.array(z.string().trim().min(1)).max(20).optional(),
	limit: z.number().int().positive().max(8).optional(),
});

const conversationRenameInputSchema = z.object({
	conversationId: z.string().trim().min(1),
	title: z.string().trim().min(1).max(200),
});

const domainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(3)
	.max(253)
	.regex(
		/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/,
		"Domain must be a hostname like example.com"
	);

const webSearchInputSchema = z.object({
	query: z.string().trim().min(3).max(500),
	maxResults: z.number().int().min(1).max(5).optional(),
	recencyDays: z.number().int().positive().max(366).optional(),
	domains: z.array(domainSchema).max(10).optional(),
});

type RagRetrieveInput = z.infer<typeof ragRetrieveInputSchema>;
type ConversationRenameInput = z.infer<typeof conversationRenameInputSchema>;
type WebSearchInput = z.infer<typeof webSearchInputSchema>;

async function ownsConversation(
	conversationId: string | null | undefined,
	context: ToolExecutionContext
) {
	if (!conversationId) return true;

	const conversation = await prisma.conversation.findFirst({
		where: {
			id: conversationId,
			userId: context.userId,
			organizationId: context.organizationId ?? null,
		},
		select: { id: true },
	});
	return Boolean(conversation);
}

export const toolDefinitions: ToolDefinition[] = [
	{
		name: "web.search",
		description:
			"Search the public web through the configured server-side search provider.",
		riskLevel: "medium",
		enabled: true,
		requiresConfirmation: false,
		timeoutMs: 10_000,
		maxAttempts: 1,
		inputSchema: webSearchInputSchema,
		buildInputSummary(input: WebSearchInput) {
			return toToolJsonValue({
				queryLength: input.query.length,
				maxResults: input.maxResults ?? 5,
				recencyDays: input.recencyDays ?? null,
				domainCount: input.domains?.length ?? 0,
			});
		},
		async authorize(_input: WebSearchInput, context) {
			return Boolean(context.userId);
		},
		async execute(input: WebSearchInput, _context, signal) {
			try {
				const response = await searchWeb(
					{
						query: input.query,
						maxResults: input.maxResults ?? 5,
						recencyDays: input.recencyDays,
						domains: input.domains,
					},
					signal
				);
				const resultLines =
					response.results.length === 0
						? ["No web search results were found."]
						: response.results.map((result, index) =>
								[
									`[${index + 1}] ${truncateText(result.title, 160)}`,
									`URL: ${result.url}`,
									result.publishedDate
										? `Published: ${result.publishedDate}`
										: null,
									`Snippet: ${truncateText(result.content, 700)}`,
								]
									.filter(Boolean)
									.join("\n")
							);

				return {
					displayText: [
						`Web search results for "${truncateText(input.query, 160)}":`,
						...resultLines,
					].join("\n\n"),
					metadata: {
						provider: response.provider,
						resultCount: response.results.length,
						responseTimeMs: response.responseTimeMs ?? null,
						requestId: response.requestId ?? null,
						usage: response.usage ?? null,
						results: response.results.map((result, index) => ({
							index: index + 1,
							title: truncateText(result.title, 160),
							url: result.url,
							domain: new URL(result.url).hostname,
							score:
								typeof result.score === "number"
									? Number(result.score.toFixed(6))
									: null,
							publishedDate: result.publishedDate ?? null,
						})),
					},
				};
			} catch (error) {
				if (error instanceof WebSearchUnavailableError) {
					throw new ToolExecutionError(error.message, {
						status: 503,
						errorCode: "WEB_SEARCH_UNAVAILABLE",
					});
				}

				throw error;
			}
		},
	},
	{
		name: "rag.retrieve_context",
		description: "Retrieve bounded context from the user's indexed files.",
		riskLevel: "low",
		enabled: true,
		requiresConfirmation: false,
		timeoutMs: 8_000,
		maxAttempts: 1,
		inputSchema: ragRetrieveInputSchema,
		buildInputSummary(input: RagRetrieveInput) {
			return toToolJsonValue({
				queryLength: input.query.length,
				fileIdCount: input.fileIds?.length ?? 0,
				limit: input.limit ?? 4,
			});
		},
		async authorize(_input: RagRetrieveInput, context) {
			return ownsConversation(context.conversationId, context);
		},
		async execute(input: RagRetrieveInput, context, signal) {
			signal.throwIfAborted();
			const chunks = await retrieveDocumentContext({
				userId: context.userId,
				organizationId: context.organizationId ?? null,
				query: input.query,
				fileIds: input.fileIds,
				limit: input.limit,
			});
			signal.throwIfAborted();

			return {
				displayText:
					chunks.length === 0
						? "No matching document context was found."
						: chunks
								.map((chunk, index) =>
									[
										`[${index + 1}] ${chunk.sourceLabel}${chunk.pageNumber ? ` page ${chunk.pageNumber}` : ""}`,
										truncateText(chunk.content, 800),
									].join("\n")
								)
								.join("\n\n"),
				metadata: {
					chunkCount: chunks.length,
					chunks: chunks.map((chunk, index) => ({
						index: index + 1,
						chunkId: chunk.chunkId,
						fileId: chunk.fileId,
						pageNumber: chunk.pageNumber,
						score: Number(chunk.score.toFixed(6)),
					})),
				},
			};
		},
	},
	{
		name: "conversation.rename",
		description:
			"Rename an owned conversation after explicit confirmation.",
		riskLevel: "medium",
		enabled: true,
		requiresConfirmation: true,
		timeoutMs: 5_000,
		maxAttempts: 1,
		inputSchema: conversationRenameInputSchema,
		buildInputSummary(input: ConversationRenameInput) {
			return toToolJsonValue({
				conversationId: input.conversationId,
				titleLength: input.title.length,
			});
		},
		async authorize(input: ConversationRenameInput, context) {
			return ownsConversation(input.conversationId, context);
		},
		async execute(input: ConversationRenameInput, context, signal) {
			signal.throwIfAborted();
			const updated = await prisma.conversation.updateMany({
				where: {
					id: input.conversationId,
					userId: context.userId,
					organizationId: context.organizationId ?? null,
				},
				data: { title: input.title },
			});
			if (updated.count !== 1) {
				throw new Error("Conversation not found");
			}

			const conversation = await prisma.conversation.findFirst({
				where: {
					id: input.conversationId,
					userId: context.userId,
					organizationId: context.organizationId ?? null,
				},
				select: {
					id: true,
					title: true,
					updatedAt: true,
				},
			});
			if (!conversation) {
				throw new Error("Conversation not found");
			}

			return {
				displayText: `Conversation renamed to "${conversation.title}".`,
				metadata: {
					conversationId: conversation.id,
					titleLength: conversation.title.length,
					updatedAt: conversation.updatedAt.toISOString(),
				},
			};
		},
	},
];

export function createToolRegistry(
	definitions: ToolDefinition[] = toolDefinitions
): ToolRegistry {
	const byName = new Map(definitions.map((tool) => [tool.name, tool]));

	return {
		get(name: string) {
			return byName.get(name) ?? null;
		},
		list() {
			return [...byName.values()];
		},
	};
}

export const defaultToolRegistry = createToolRegistry();
