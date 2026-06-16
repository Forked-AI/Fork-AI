-- Phase 5 RAG production vector search.
-- Keeps embedding.vectorJson as the portable fallback while adding a native
-- pgvector column and HNSW index for database-side cosine ranking.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "embedding"
	ADD COLUMN IF NOT EXISTS "vector_pg" vector;

UPDATE "embedding"
SET "vector_pg" = "vectorJson"::vector
WHERE "vector_pg" IS NULL
	AND "vectorJson" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "embedding_user_vector_filter_idx"
	ON "embedding" ("userId", "provider", "model", "dimensions")
	WHERE "vector_pg" IS NOT NULL;

-- The built-in local embedding provider uses 256 dimensions. The expression
-- index keeps the column flexible for future providers while still allowing
-- HNSW acceleration for the current production path.
CREATE INDEX IF NOT EXISTS "embedding_vector_pg_256_hnsw_idx"
	ON "embedding"
	USING hnsw (("vector_pg"::vector(256)) vector_cosine_ops)
	WHERE "vector_pg" IS NOT NULL AND "dimensions" = 256;
