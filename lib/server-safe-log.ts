// Server-only: import this module only from route handlers or backend code.
type SafeLogValue = string | number | boolean | null | undefined;
type SafeLogMetadata = Record<string, SafeLogValue>;

const SENSITIVE_KEY_PATTERN =
	/(authorization|content|cookie|database|email|key|message|password|prompt|secret|token|url)/i;

function redactMetadata(metadata: SafeLogMetadata = {}): SafeLogMetadata {
	return Object.fromEntries(
		Object.entries(metadata).map(([key, value]) => [
			key,
			SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value,
		])
	);
}

function getErrorMetadata(error: unknown): SafeLogMetadata {
	if (!error || typeof error !== "object") {
		return { errorType: typeof error };
	}

	const errorRecord = error as {
		name?: unknown;
		status?: unknown;
		statusCode?: unknown;
		rawResponse?: { status?: unknown };
	};

	return {
		errorName:
			typeof errorRecord.name === "string"
				? errorRecord.name
				: error.constructor.name,
		status:
			typeof errorRecord.status === "number"
				? errorRecord.status
				: undefined,
		statusCode:
			typeof errorRecord.statusCode === "number"
				? errorRecord.statusCode
				: undefined,
		providerStatusCode:
			typeof errorRecord.rawResponse?.status === "number"
				? errorRecord.rawResponse.status
				: undefined,
	};
}

export function logServerError(
	scope: string,
	event: string,
	error: unknown,
	metadata?: SafeLogMetadata
) {
	// eslint-disable-next-line no-console
	console.error(`[${scope}] ${event}`, {
		...redactMetadata(metadata),
		...getErrorMetadata(error),
	});
}

export function logServerWarning(
	scope: string,
	event: string,
	metadata?: SafeLogMetadata
) {
	// eslint-disable-next-line no-console
	console.warn(`[${scope}] ${event}`, redactMetadata(metadata));
}

export function logServerInfo(
	scope: string,
	event: string,
	metadata?: SafeLogMetadata
) {
	// eslint-disable-next-line no-console
	console.info(`[${scope}] ${event}`, redactMetadata(metadata));
}
