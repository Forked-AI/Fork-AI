import { normalizeProviderStreamError } from "@/lib/ai/errors";
import type {
	ModelProvider,
	ModelRequest,
	ModelStreamChunk,
} from "@/lib/ai/model-provider";

const DEFAULT_MAX_ATTEMPTS_PER_MODEL = 2;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 5_000;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_OPEN_MS = 30_000;

interface CircuitState {
	consecutiveFailures: number;
	openUntil: number;
}

const circuits = new Map<string, CircuitState>();

export class ProviderCircuitOpenError extends Error {
	readonly statusCode = 503;
	readonly code = "PROVIDER_CIRCUIT_OPEN";
	readonly provider: string;
	readonly model: string;
	readonly retryAfterSeconds: number;

	constructor(provider: string, model: string, _retryAfterSeconds: number) {
		super(`Provider circuit is temporarily open for ${provider}/${model}.`);
		this.name = "ProviderCircuitOpenError";
		this.provider = provider;
		this.model = model;
		this.retryAfterSeconds = _retryAfterSeconds;
	}
}

export interface ResilientStreamAttempt {
	provider: string;
	model: string;
	attempt: number;
	retryCount: number;
	fallbackCount: number;
	status: "started" | "retrying" | "failed" | "succeeded" | "circuit_open";
	errorCode?: string;
	providerStatusCode?: number;
	delayMs?: number;
}

export interface ResilientModelStreamOptions {
	providerName: string;
	provider: ModelProvider;
	primaryModel: string;
	fallbackModels?: string[];
	request: Omit<ModelRequest, "model">;
	maxAttemptsPerModel?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	failureThreshold?: number;
	openMs?: number;
	now?: () => number;
	sleep?: (_delayMs: number) => Promise<void>;
	onAttempt?: (_attempt: ResilientStreamAttempt) => void | Promise<void>;
}

function envNumber(name: string, fallback: number, minimum: number) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value >= minimum ? value : fallback;
}

function circuitKey(provider: string, model: string) {
	return `${provider}:${model}`;
}

function getCircuitState(key: string) {
	const state = circuits.get(key);
	if (state) return state;
	const created = { consecutiveFailures: 0, openUntil: 0 };
	circuits.set(key, created);
	return created;
}

function markSuccess(key: string) {
	circuits.delete(key);
}

function markRetryableFailure(
	key: string,
	now: number,
	failureThreshold: number,
	openMs: number
) {
	const state = getCircuitState(key);
	state.consecutiveFailures += 1;
	if (state.consecutiveFailures >= failureThreshold) {
		state.openUntil = now + openMs;
		state.consecutiveFailures = 0;
	}
}

function isAbortError(error: unknown) {
	return (
		error instanceof Error &&
		(error.name === "AbortError" ||
			error.message === "The operation was aborted")
	);
}

export function isRetryableProviderError(error: unknown) {
	if (isAbortError(error)) return false;
	if (error instanceof ProviderCircuitOpenError) return false;
	const normalized = normalizeProviderStreamError(error);
	const status = normalized.providerStatusCode;
	return (
		status === 408 ||
		status === 409 ||
		status === 425 ||
		status === 429 ||
		(status !== undefined && status >= 500 && status <= 599)
	);
}

function retryDelayMs(options: {
	error: unknown;
	attempt: number;
	baseDelayMs: number;
	maxDelayMs: number;
}) {
	const normalized = normalizeProviderStreamError(options.error);
	const retryAfterMs = normalized.retryAfterSeconds
		? normalized.retryAfterSeconds * 1000
		: 0;
	const exponential = options.baseDelayMs * 2 ** (options.attempt - 1);
	return Math.min(options.maxDelayMs, Math.max(retryAfterMs, exponential));
}

export async function* resilientModelStream(
	options: ResilientModelStreamOptions
): AsyncIterable<ModelStreamChunk> {
	const now = options.now ?? Date.now;
	const sleep =
		options.sleep ??
		((delayMs: number) =>
			new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
	const maxAttemptsPerModel =
		options.maxAttemptsPerModel ??
		envNumber(
			"AI_PROVIDER_MAX_ATTEMPTS_PER_MODEL",
			DEFAULT_MAX_ATTEMPTS_PER_MODEL,
			1
		);
	const baseDelayMs =
		options.baseDelayMs ??
		envNumber("AI_PROVIDER_RETRY_BASE_MS", DEFAULT_BASE_DELAY_MS, 0);
	const maxDelayMs =
		options.maxDelayMs ??
		envNumber("AI_PROVIDER_RETRY_MAX_MS", DEFAULT_MAX_DELAY_MS, 0);
	const failureThreshold =
		options.failureThreshold ??
		envNumber(
			"AI_PROVIDER_CIRCUIT_FAILURE_THRESHOLD",
			DEFAULT_FAILURE_THRESHOLD,
			1
		);
	const openMs =
		options.openMs ??
		envNumber("AI_PROVIDER_CIRCUIT_OPEN_MS", DEFAULT_OPEN_MS, 1);
	const models = [
		options.primaryModel,
		...(options.fallbackModels ?? []).filter(
			(model) => model !== options.primaryModel
		),
	];
	let retryCount = 0;

	for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
		const model = models[modelIndex];
		const key = circuitKey(options.providerName, model);

		for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
			const state = getCircuitState(key);
			const currentTime = now();
			if (state.openUntil > currentTime) {
				const circuitError = new ProviderCircuitOpenError(
					options.providerName,
					model,
					Math.max(
						1,
						Math.ceil((state.openUntil - currentTime) / 1000)
					)
				);
				await options.onAttempt?.({
					provider: options.providerName,
					model,
					attempt,
					retryCount,
					fallbackCount: modelIndex,
					status: "circuit_open",
					errorCode: circuitError.code,
					providerStatusCode: circuitError.statusCode,
				});
				break;
			}
			if (state.openUntil > 0) circuits.delete(key);

			await options.onAttempt?.({
				provider: options.providerName,
				model,
				attempt,
				retryCount,
				fallbackCount: modelIndex,
				status: "started",
			});

			let emittedContent = false;
			try {
				const stream = await options.provider.stream({
					...options.request,
					model,
				});
				for await (const chunk of stream) {
					if (chunk.content) emittedContent = true;
					yield {
						...chunk,
						attempt,
						retryCount,
						fallbackCount: modelIndex,
						requestedModel: model,
					};
				}
				markSuccess(key);
				await options.onAttempt?.({
					provider: options.providerName,
					model,
					attempt,
					retryCount,
					fallbackCount: modelIndex,
					status: "succeeded",
				});
				return;
			} catch (error) {
				const normalized = normalizeProviderStreamError(error);
				const retryable =
					!emittedContent && isRetryableProviderError(error);
				if (retryable) {
					markRetryableFailure(key, now(), failureThreshold, openMs);
				}
				await options.onAttempt?.({
					provider: options.providerName,
					model,
					attempt,
					retryCount,
					fallbackCount: modelIndex,
					status: "failed",
					errorCode: normalized.errorCode,
					providerStatusCode: normalized.providerStatusCode,
				});
				const canRetrySameModel =
					retryable && attempt < maxAttemptsPerModel;
				const canFallback = retryable && modelIndex < models.length - 1;
				if (!canRetrySameModel && !canFallback) throw error;

				if (canRetrySameModel) {
					retryCount += 1;
					const delayMs = retryDelayMs({
						error,
						attempt,
						baseDelayMs,
						maxDelayMs,
					});
					await options.onAttempt?.({
						provider: options.providerName,
						model,
						attempt,
						retryCount,
						fallbackCount: modelIndex,
						status: "retrying",
						errorCode: normalized.errorCode,
						providerStatusCode: normalized.providerStatusCode,
						delayMs,
					});
					await sleep(delayMs);
				} else {
					break;
				}
			}
		}
	}

	throw new ProviderCircuitOpenError(
		options.providerName,
		options.primaryModel,
		1
	);
}

export function resetProviderCircuitsForTests() {
	circuits.clear();
}
