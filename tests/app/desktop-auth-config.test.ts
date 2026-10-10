// @vitest-environment node
import { GET } from "@/app/api/desktop/auth-config/route";
import { describe, expect, it } from "vitest";

describe("desktop sign-in compatibility", () => {
	it("publishes only the supported desktop contract without caching", async () => {
		const response = GET();
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual({
			version: 1,
			clientID: "forkai-desktop",
			protocol: "tech.forkai.desktop",
			callbackPath: "/auth/callback",
		});
	});
});
