import {
	normalizeKeyboardEvent,
	stringifyShortcut,
	validateShortcutString,
} from "@/lib/keyboard-shortcuts";
import { describe, expect, it } from "vitest";

describe("keyboard shortcut utilities", () => {
	it("accepts the default recent chat shortcut", () => {
		expect(validateShortcutString("Alt+Q")).toEqual({ valid: true });
	});

	it("rejects reserved browser and OS tab switching shortcuts", () => {
		expect(validateShortcutString("Alt+Tab").valid).toBe(false);
		expect(validateShortcutString("Ctrl+Tab").valid).toBe(false);
		expect(validateShortcutString("Cmd+Tab").valid).toBe(false);
	});

	it("rejects existing Fork.AI global shortcut conflicts", () => {
		expect(validateShortcutString("Ctrl+K").valid).toBe(false);
		expect(validateShortcutString("Cmd+K").valid).toBe(false);
		expect(validateShortcutString("Ctrl+/").valid).toBe(false);
		expect(validateShortcutString("Cmd+/").valid).toBe(false);
	});

	it("normalizes modifier order consistently", () => {
		const combo = normalizeKeyboardEvent({
			key: "q",
			ctrlKey: true,
			metaKey: false,
			altKey: true,
			shiftKey: true,
		} as KeyboardEvent);

		expect(stringifyShortcut(combo)).toBe("Ctrl+Alt+Shift+Q");
	});
});
