import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/api/chat/stream service boundary", () => {
	it("does not import the provider SDK or Mistral client directly", () => {
		const source = readFileSync(
			join(process.cwd(), "app/api/chat/stream/route.ts"),
			"utf8"
		);

		expect(source).not.toContain("@mistralai");
		expect(source).not.toContain("mistralClient");
	});
});
