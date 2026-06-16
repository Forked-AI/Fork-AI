export interface KeyboardShortcutCombo {
	key: string;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

export interface ShortcutValidationResult {
	valid: boolean;
	message?: string;
}

const MODIFIER_LABELS = ["Ctrl", "Cmd", "Alt", "Shift"] as const;
const RESERVED_SHORTCUTS = new Set([
	"Ctrl+I",
	"Cmd+B",
	"Ctrl+B",
	"Cmd+K",
	"Ctrl+K",
	"Cmd+/",
	"Ctrl+/",
]);

const MODIFIER_KEYS = new Set([
	"Alt",
	"Control",
	"Meta",
	"Shift",
	"OS",
	"AltGraph",
]);

function normalizeShortcutKey(key: string) {
	if (key === " ") return "Space";
	if (key === "Esc") return "Escape";
	if (key.length === 1) return key.toUpperCase();
	return key;
}

export function normalizeKeyboardEvent(
	event: Pick<
		KeyboardEvent,
		"key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
	>
): KeyboardShortcutCombo {
	return {
		key: normalizeShortcutKey(event.key),
		altKey: event.altKey,
		ctrlKey: event.ctrlKey,
		metaKey: event.metaKey,
		shiftKey: event.shiftKey,
	};
}

export function parseShortcut(shortcut: string): KeyboardShortcutCombo {
	const parts = shortcut
		.split("+")
		.map((part) => part.trim())
		.filter(Boolean);
	const combo: KeyboardShortcutCombo = {
		key: "",
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
	};

	for (const part of parts) {
		const normalizedPart = part.toLowerCase();
		if (normalizedPart === "alt" || normalizedPart === "option") {
			combo.altKey = true;
		} else if (normalizedPart === "ctrl" || normalizedPart === "control") {
			combo.ctrlKey = true;
		} else if (
			normalizedPart === "cmd" ||
			normalizedPart === "command" ||
			normalizedPart === "meta"
		) {
			combo.metaKey = true;
		} else if (normalizedPart === "shift") {
			combo.shiftKey = true;
		} else {
			combo.key = normalizeShortcutKey(part);
		}
	}

	return combo;
}

export function stringifyShortcut(combo: KeyboardShortcutCombo) {
	const parts: string[] = [];
	if (combo.ctrlKey) parts.push("Ctrl");
	if (combo.metaKey) parts.push("Cmd");
	if (combo.altKey) parts.push("Alt");
	if (combo.shiftKey) parts.push("Shift");
	if (combo.key) parts.push(normalizeShortcutKey(combo.key));
	return parts.join("+");
}

export function shortcutLabelParts(shortcut: string) {
	const parsed = parseShortcut(shortcut);
	const label = stringifyShortcut(parsed);
	return label ? label.split("+") : [];
}

export function shortcutMatchesEvent(
	event: Pick<
		KeyboardEvent,
		"key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
	>,
	shortcut: string,
	options: { ignoreShift?: boolean } = {}
) {
	const expected = parseShortcut(shortcut);
	const actual = normalizeKeyboardEvent(event);

	return (
		actual.key === expected.key &&
		actual.altKey === expected.altKey &&
		actual.ctrlKey === expected.ctrlKey &&
		actual.metaKey === expected.metaKey &&
		(options.ignoreShift || actual.shiftKey === expected.shiftKey)
	);
}

export function releasedKeyConfirmsShortcut(key: string, shortcut: string) {
	const combo = parseShortcut(shortcut);
	return (
		(key === "Alt" && combo.altKey) ||
		(key === "Control" && combo.ctrlKey) ||
		((key === "Meta" || key === "OS") && combo.metaKey)
	);
}

export function validateShortcut(
	combo: KeyboardShortcutCombo
): ShortcutValidationResult {
	const shortcut = stringifyShortcut(combo);
	const modifierCount = MODIFIER_LABELS.reduce((count, modifier) => {
		if (modifier === "Alt") return count + (combo.altKey ? 1 : 0);
		if (modifier === "Ctrl") return count + (combo.ctrlKey ? 1 : 0);
		if (modifier === "Cmd") return count + (combo.metaKey ? 1 : 0);
		return count + (combo.shiftKey ? 1 : 0);
	}, 0);
	const nonShiftModifierCount =
		(combo.altKey ? 1 : 0) +
		(combo.ctrlKey ? 1 : 0) +
		(combo.metaKey ? 1 : 0);

	if (!combo.key || MODIFIER_KEYS.has(combo.key)) {
		return {
			valid: false,
			message: "Press a letter, number, or symbol with a modifier.",
		};
	}

	if (modifierCount === 0 || nonShiftModifierCount === 0) {
		return {
			valid: false,
			message: "Use Alt, Ctrl, or Cmd with another key.",
		};
	}

	if (combo.key === "Tab") {
		return {
			valid: false,
			message: "Tab shortcuts are reserved by browsers and the OS.",
		};
	}

	if (RESERVED_SHORTCUTS.has(shortcut)) {
		return {
			valid: false,
			message: `${shortcut} is already used by Fork.AI.`,
		};
	}

	return { valid: true };
}

export function validateShortcutString(shortcut: string) {
	return validateShortcut(parseShortcut(shortcut));
}

export function isEditableShortcutTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	const tagName = target.tagName.toLowerCase();
	return (
		tagName === "input" ||
		tagName === "textarea" ||
		tagName === "select" ||
		target.isContentEditable
	);
}
