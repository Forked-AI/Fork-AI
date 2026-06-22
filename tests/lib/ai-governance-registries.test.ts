import { validateModelRegistry } from "@/lib/ai/model-registry";
import { validatePromptRegistry } from "@/lib/ai/prompt-registry";
import { assertProviderKeyCanBePersisted } from "@/lib/provider-keys/policy";
import { describe, expect, it } from "vitest";

describe("AI governance registries", () => {
	it("validates model and prompt registry records", () => {
		expect(validateModelRegistry().length).toBeGreaterThan(0);
		expect(validatePromptRegistry().length).toBeGreaterThan(0);
	});

	it("requires BYOK credentials to be encrypted before persistence", () => {
		expect(
			assertProviderKeyCanBePersisted({
				encrypted: false,
				provider: "openai",
				scope: "user",
			})
		).toMatchObject({
			ok: false,
			errorCode: "PROVIDER_KEY_MUST_BE_ENCRYPTED",
		});

		expect(
			assertProviderKeyCanBePersisted({
				encrypted: true,
				provider: "openai",
				scope: "organization",
			})
		).toMatchObject({ ok: true });
	});
});
