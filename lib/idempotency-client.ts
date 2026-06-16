const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

function fallbackRandomId() {
	return `${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 12)}`;
}

export function createIdempotencyKey(scope?: string) {
	const randomId =
		globalThis.crypto?.randomUUID?.() ?? fallbackRandomId();

	return scope ? `${scope}:${randomId}` : randomId;
}

export function createIdempotencyHeaders(scope?: string) {
	return {
		[IDEMPOTENCY_KEY_HEADER]: createIdempotencyKey(scope),
	};
}
