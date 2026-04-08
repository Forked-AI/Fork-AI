const DEFAULT_AUTH_CALLBACK_PATH = '/chat'

export function getSafeInternalRedirectPath(value: string | null | undefined) {
	if (!value) return null

	const trimmed = value.trim()
	if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
		return null
	}

	return trimmed
}

export function resolveAuthCallbackPath(
	value: string | null | undefined,
	fallback: string = DEFAULT_AUTH_CALLBACK_PATH
) {
	return getSafeInternalRedirectPath(value) ?? fallback
}

export function buildPreservedNextQuery(value: string | null | undefined) {
	const safePath = getSafeInternalRedirectPath(value)
	return safePath ? `?next=${encodeURIComponent(safePath)}` : ''
}
