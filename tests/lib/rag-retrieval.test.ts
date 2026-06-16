import { retrieveDocumentContext } from "@/lib/rag/retrieval";
import { describe, expect, it, vi } from "vitest";

const embeddingProvider = {
	embedText: vi.fn(async () => ({
		provider: "local",
		model: "feature-hash-v1",
		dimensions: 2,
		vector: [1, 0],
	})),
};

describe("RAG retrieval", () => {
	it("rejects retrieval without a user permission filter", async () => {
		await expect(
			retrieveDocumentContext({
				userId: "",
				query: "budget policy",
				prismaClient: {
					documentChunk: {
						findMany: vi.fn(),
					},
				},
				embeddingProvider,
			})
		).rejects.toThrow("userId permission filter");
	});

	it("filters by owner and requested files before ranking chunks", async () => {
		const prismaClient = {
			documentChunk: {
				findMany: vi.fn(async () => [
					{
						id: "chunk-2",
						fileId: "file-1",
						content: "irrelevant",
						sourceLabel: "notes.md#2",
						pageNumber: null,
						embedding: { vectorJson: JSON.stringify([0, 1]) },
					},
					{
						id: "chunk-1",
						fileId: "file-1",
						content: "budget policy",
						sourceLabel: "notes.md#1",
						pageNumber: null,
						embedding: { vectorJson: JSON.stringify([1, 0]) },
					},
				]),
			},
		};

		await expect(
			retrieveDocumentContext({
				userId: "user-1",
				query: "budget policy",
				fileIds: ["file-1", "file-1", ""],
				limit: 2,
				prismaClient,
				embeddingProvider,
			})
		).resolves.toMatchObject([
			{ chunkId: "chunk-1", fileId: "file-1", score: 1 },
			{ chunkId: "chunk-2", fileId: "file-1", score: 0 },
		]);

		expect(prismaClient.documentChunk.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					userId: "user-1",
					file: { status: "ready" },
					fileId: { in: ["file-1"] },
				},
			})
		);
	});

	it("uses pgvector search with mandatory ownership filters when available", async () => {
		const prismaClient = {
			$queryRawUnsafe: vi.fn(async () => [
				{
					chunkId: "chunk-1",
					fileId: "file-1",
					content: "budget policy",
					sourceLabel: "notes.md#1",
					pageNumber: null,
					score: 0.93,
				},
			]),
			documentChunk: {
				findMany: vi.fn(),
			},
		};

		await expect(
			retrieveDocumentContext({
				userId: "user-1",
				organizationId: "org-1",
				query: "budget policy",
				fileIds: ["file-1"],
				limit: 1,
				prismaClient,
				embeddingProvider,
				vectorSearchMode: "pgvector",
			})
		).resolves.toEqual([
			{
				chunkId: "chunk-1",
				fileId: "file-1",
				content: "budget policy",
				sourceLabel: "notes.md#1",
				pageNumber: null,
				score: 0.93,
			},
		]);

		const [
			sql,
			vectorLiteral,
			userId,
			dimensions,
			organizationId,
			fileIds,
		] = prismaClient.$queryRawUnsafe.mock.calls[0] as unknown[];
		expect(sql).toContain('dc."userId" = $2');
		expect(sql).toContain('f."userId" = $2');
		expect(sql).toContain('dc."organizationId" = $4');
		expect(sql).toContain('dc."fileId" = ANY($5::text[])');
		expect(sql).toContain('e."vector_pg" IS NOT NULL');
		expect(vectorLiteral).toBe("[1,0]");
		expect(userId).toBe("user-1");
		expect(dimensions).toBe(2);
		expect(organizationId).toBe("org-1");
		expect(fileIds).toEqual(["file-1"]);
		expect(prismaClient.documentChunk.findMany).not.toHaveBeenCalled();
	});

	it("falls back to JSON vector ranking when pgvector is unavailable in auto mode", async () => {
		const prismaClient = {
			$queryRawUnsafe: vi.fn(async () => {
				const error = new Error(
					'column "vector_pg" does not exist'
				) as Error & {
					code?: string;
				};
				error.code = "42703";
				throw error;
			}),
			documentChunk: {
				findMany: vi.fn(async () => [
					{
						id: "chunk-1",
						fileId: "file-1",
						content: "budget policy",
						sourceLabel: "notes.md#1",
						pageNumber: null,
						embedding: { vectorJson: JSON.stringify([1, 0]) },
					},
				]),
			},
		};

		await expect(
			retrieveDocumentContext({
				userId: "user-1",
				query: "budget policy",
				fileIds: ["file-1"],
				limit: 1,
				prismaClient,
				embeddingProvider,
				vectorSearchMode: "auto",
			})
		).resolves.toMatchObject([
			{ chunkId: "chunk-1", fileId: "file-1", score: 1 },
		]);
		expect(prismaClient.documentChunk.findMany).toHaveBeenCalled();
	});
});
