export interface NormalizedStreamError {
	message: string;
	errorCode: string;
	providerStatusCode?: number;
	retryAfterSeconds?: number;
	providerRequestId?: string;
}

function getHeaderValue(headers: unknown, headerName: string): string | null {
	if (!headers) {
		return null;
	}

	if (headers instanceof Headers) {
		return headers.get(headerName);
	}

	if (typeof headers !== "object") {
		return null;
	}

	const lowerHeaderName = headerName.toLowerCase();
	for (const [key, value] of Object.entries(
		headers as Record<string, unknown>
	)) {
		if (key.toLowerCase() !== lowerHeaderName) {
			continue;
		}

		if (typeof value === "string") {
			return value;
		}

		if (Array.isArray(value) && value.length > 0) {
			return String(value[0]);
		}

		if (value != null) {
			return String(value);
		}
	}

	return null;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
	if (!value) {
		return undefined;
	}

	const asNumber = Number(value);
	if (Number.isFinite(asNumber) && asNumber >= 0) {
		return Math.ceil(asNumber);
	}

	const asDateMs = Date.parse(value);
	if (Number.isNaN(asDateMs)) {
		return undefined;
	}

	return Math.max(0, Math.ceil((asDateMs - Date.now()) / 1000));
}

export function normalizeProviderStreamError(
	error: unknown
): NormalizedStreamError {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: unknown }).code === "PROVIDER_CIRCUIT_OPEN"
	) {
		const circuitError = error as {
			retryAfterSeconds?: number;
			statusCode?: number;
		};
		return {
			message:
				"The selected model is temporarily unavailable. Please retry shortly.",
			errorCode: "PROVIDER_CIRCUIT_OPEN",
			providerStatusCode: circuitError.statusCode ?? 503,
			retryAfterSeconds: circuitError.retryAfterSeconds,
		};
	}

	const providerError = error as {
		statusCode?: number;
		status?: number;
		headers?: unknown;
		rawResponse?: {
			status?: number;
			headers?: unknown;
		};
	};

	const providerStatusCode =
		providerError.statusCode ??
		providerError.status ??
		providerError.rawResponse?.status;
	const providerHeaders =
		providerError.headers ?? providerError.rawResponse?.headers;
	const retryAfterSeconds =
		parseRetryAfterSeconds(
			getHeaderValue(providerHeaders, "retry-after")
		) ??
		parseRetryAfterSeconds(
			getHeaderValue(providerHeaders, "x-ratelimit-reset")
		);
	const providerRequestId =
		getHeaderValue(providerHeaders, "mistral-correlation-id") ??
		getHeaderValue(providerHeaders, "x-kong-request-id") ??
		undefined;

	if (providerStatusCode === 429) {
		return {
			message: "Model rate limit reached. Please retry in a moment.",
			errorCode: "PROVIDER_RATE_LIMITED",
			providerStatusCode,
			retryAfterSeconds,
			providerRequestId,
		};
	}

	return {
		message: "Stream interrupted. You can retry this message.",
		errorCode: "STREAM_INTERRUPTED",
		providerStatusCode,
		providerRequestId,
	};
}
