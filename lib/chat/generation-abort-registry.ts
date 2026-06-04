const generationAbortControllers = new Map<string, AbortController>();

export function registerGenerationAbortController(
	generationId: string,
	controller: AbortController
) {
	generationAbortControllers.set(generationId, controller);
}

export function unregisterGenerationAbortController(generationId: string) {
	generationAbortControllers.delete(generationId);
}

export function abortRegisteredGeneration(generationId: string) {
	const controller = generationAbortControllers.get(generationId);
	if (!controller) {
		return false;
	}

	controller.abort();
	generationAbortControllers.delete(generationId);
	return true;
}
