import {
	logServerError,
	logServerInfo,
	logServerWarning,
} from "@/lib/server-safe-log";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("server-safe-log", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("redacts sensitive metadata from error logs", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		logServerError(
			"test",
			"failed",
			{ statusCode: 500 },
			{
				messageContent: "secret prompt",
				apiKey: "key-1",
				safeCount: 2,
			}
		);

		expect(spy).toHaveBeenCalledWith(
			"[test] failed",
			expect.objectContaining({
				messageContent: "[redacted]",
				apiKey: "[redacted]",
				safeCount: 2,
				statusCode: 500,
			})
		);
	});

	it("redacts sensitive metadata from warning and info logs", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		logServerWarning("test", "warned", {
			token: "share-token",
			remaining: 0,
		});
		logServerInfo("test", "observed", {
			url: "https://fork.ai/share/token",
			promptVersion: "chat-context-v1",
			promptText: "raw prompt",
			remaining: 1,
		});

		expect(warnSpy).toHaveBeenCalledWith("[test] warned", {
			token: "[redacted]",
			remaining: 0,
		});
		expect(infoSpy).toHaveBeenCalledWith("[test] observed", {
			url: "[redacted]",
			promptVersion: "chat-context-v1",
			promptText: "[redacted]",
			remaining: 1,
		});
	});
});
