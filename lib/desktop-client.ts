interface ForkDesktop {
	signInWithGoogle: () => Promise<void>;
	retry: () => Promise<void>;
}

declare global {
	interface Window {
		forkDesktop?: ForkDesktop;
	}
}

export function getDesktopClient() {
	return typeof window === "undefined" ? undefined : window.forkDesktop;
}
