import "@testing-library/jest-dom";

process.env.AI_PROVIDER_RETRY_BASE_MS = "0";
process.env.AI_PROVIDER_RETRY_MAX_MS = "0";

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

if (!globalThis.ResizeObserver) {
	globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
}

class IntersectionObserverMock {
	readonly root = null;
	readonly rootMargin = "0px";
	readonly thresholds = [0];

	disconnect() {}
	observe() {}
	takeRecords() {
		return [];
	}
	unobserve() {}
}

if (!globalThis.IntersectionObserver) {
	globalThis.IntersectionObserver =
		IntersectionObserverMock as unknown as typeof IntersectionObserver;
}
