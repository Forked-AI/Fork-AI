const REDACTION_PATTERNS: Array<[RegExp, string]> = [
	[/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]"],
	[/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-token]"],
	[
		/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi,
		"[redacted-secret]",
	],
	[/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted-identifier]"],
	[/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-number]"],
];

export function redactFeedbackText(value: string) {
	let redacted = value;
	let replacementCount = 0;
	for (const [pattern, replacement] of REDACTION_PATTERNS) {
		redacted = redacted.replace(pattern, () => {
			replacementCount += 1;
			return replacement;
		});
	}
	return { redacted, replacementCount };
}

export function redactFeedbackCorrection<T extends Record<string, string>>(
	correction: T
) {
	let replacementCount = 0;
	const redacted = Object.fromEntries(
		Object.entries(correction).map(([key, value]) => {
			const result = redactFeedbackText(value);
			replacementCount += result.replacementCount;
			return [key, result.redacted];
		})
	) as T;
	return { redacted, replacementCount };
}
