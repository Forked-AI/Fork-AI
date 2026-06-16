type CancelableCallback<TArgs extends unknown[]> = ((
	..._args: TArgs
) => void) & {
	cancel: () => void;
};

export function createRafThrottle<TArgs extends unknown[]>(
	callback: (..._args: TArgs) => void
): CancelableCallback<TArgs> {
	let frameId: number | null = null;
	let latestArgs: TArgs | null = null;

	const throttled = ((...args: TArgs) => {
		latestArgs = args;

		if (frameId !== null) {
			return;
		}

		frameId = requestAnimationFrame(() => {
			frameId = null;
			const argsToUse = latestArgs;
			latestArgs = null;

			if (argsToUse) {
				callback(...argsToUse);
			}
		});
	}) as CancelableCallback<TArgs>;

	throttled.cancel = () => {
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}

		latestArgs = null;
	};

	return throttled;
}

export function createDebouncedCallback<TArgs extends unknown[]>(
	callback: (..._args: TArgs) => void,
	delayMs: number
): CancelableCallback<TArgs> {
	let timerId: ReturnType<typeof setTimeout> | null = null;

	const debounced = ((...args: TArgs) => {
		if (timerId !== null) {
			clearTimeout(timerId);
		}

		timerId = setTimeout(() => {
			timerId = null;
			callback(...args);
		}, delayMs);
	}) as CancelableCallback<TArgs>;

	debounced.cancel = () => {
		if (timerId !== null) {
			clearTimeout(timerId);
			timerId = null;
		}
	};

	return debounced;
}
