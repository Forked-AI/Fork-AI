import { createHash } from "node:crypto";

export interface DocumentTextChunk {
	id: string;
	chunkIndex: number;
	content: string;
	contentHash: string;
	pageNumber: number | null;
	sourceLabel: string;
}

export interface ChunkDocumentInput {
	fileId: string;
	text: string;
	sourceLabel: string;
	pageCount?: number;
	chunkSize?: number;
	overlapSize?: number;
}

const DEFAULT_CHUNK_SIZE = 1_200;
const DEFAULT_OVERLAP_SIZE = 160;

function createHashHex(input: string) {
	return createHash("sha256").update(input).digest("hex");
}

function normalizeChunkContent(content: string) {
	return content
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function createStableChunkId({
	fileId,
	chunkIndex,
	content,
}: {
	fileId: string;
	chunkIndex: number;
	content: string;
}) {
	return `chk_${createHashHex(`${fileId}:${chunkIndex}:${content}`).slice(0, 32)}`;
}

export function chunkDocumentText(
	input: ChunkDocumentInput
): DocumentTextChunk[] {
	const chunkSize = Math.max(200, input.chunkSize ?? DEFAULT_CHUNK_SIZE);
	const overlapSize = Math.min(
		Math.max(0, input.overlapSize ?? DEFAULT_OVERLAP_SIZE),
		Math.floor(chunkSize / 3)
	);
	const text = normalizeChunkContent(input.text);
	const chunks: DocumentTextChunk[] = [];
	let offset = 0;
	let chunkIndex = 0;

	while (offset < text.length) {
		const hardEnd = Math.min(offset + chunkSize, text.length);
		const softBreak = text.lastIndexOf("\n\n", hardEnd);
		const sentenceBreak = text.lastIndexOf(". ", hardEnd);
		const end =
			softBreak > offset + chunkSize * 0.6
				? softBreak
				: sentenceBreak > offset + chunkSize * 0.6
					? sentenceBreak + 1
					: hardEnd;
		const content = normalizeChunkContent(text.slice(offset, end));

		if (content) {
			const pageNumber =
				input.pageCount && input.pageCount > 1
					? Math.min(
							input.pageCount,
							Math.max(
								1,
								Math.ceil(
									((offset + content.length / 2) /
										text.length) *
										input.pageCount
								)
							)
						)
					: null;

			chunks.push({
				id: createStableChunkId({
					fileId: input.fileId,
					chunkIndex,
					content,
				}),
				chunkIndex,
				content,
				contentHash: createHashHex(content),
				pageNumber,
				sourceLabel: `${input.sourceLabel}#${chunkIndex + 1}`,
			});
			chunkIndex += 1;
		}

		if (hardEnd >= text.length) break;
		offset = Math.max(end - overlapSize, offset + 1);
	}

	return chunks;
}
