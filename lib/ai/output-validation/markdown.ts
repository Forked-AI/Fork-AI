const UNSAFE_MARKDOWN_PATTERNS = [
	/javascript:/i,
	/data:text\/html/i,
	/<\s*script/i,
	/onerror\s*=/i,
	/onload\s*=/i,
];

export function validateMarkdownSafety(markdown: string) {
	const matched = UNSAFE_MARKDOWN_PATTERNS.find((pattern) =>
		pattern.test(markdown)
	);
	if (!matched) {
		return { ok: true as const };
	}

	return {
		ok: false as const,
		errorCode: "UNSAFE_MARKDOWN_OUTPUT",
		pattern: matched.source,
	};
}
