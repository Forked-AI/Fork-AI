// @vitest-environment node
import { electron } from "@better-auth/electron";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DESKTOP_CLIENT_ID, DESKTOP_PROTOCOL } from "@/lib/desktop-config";

describe("desktop browser session handoff", () => {
	it("requires PKCE and state, creates an authenticated session, and rejects replay", async () => {
		const database = {
			user: [],
			session: [],
			account: [],
			verification: [],
		};
		const auth = betterAuth({
			baseURL: "http://localhost:3000",
			secret: "desktop-test-only-secret-at-least-thirty-two-characters",
			database: memoryAdapter(database),
			emailAndPassword: { enabled: true },
			trustedOrigins: [`${DESKTOP_PROTOCOL}:/`],
			rateLimit: { enabled: false },
			plugins: [electron({ clientID: DESKTOP_CLIENT_ID })],
		});
		const browser = await auth.api.signUpEmail({
			body: {
				email: "desktop@example.com",
				password: "password-for-desktop-test",
				name: "Desktop User",
			},
			asResponse: true,
		});
		expect(browser.status).toBe(200);
		const cookie = browser.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		const verifier = randomBytes(32).toString("base64url");
		const state = "statefordesktop1";
		const transfer = await auth.api.electronTransferUser({
			body: {},
			query: {
				client_id: DESKTOP_CLIENT_ID,
				state,
				code_challenge: createHash("sha256")
					.update(verifier)
					.digest("base64url"),
				code_challenge_method: "S256",
			},
			headers: new Headers({ cookie, origin: "http://localhost:3000" }),
			asResponse: true,
		});
		expect(transfer.status).toBe(200);
		const grant = await transfer.json();
		expect(grant.electron_authorization_code).toBeTruthy();
		const exchange = (codeVerifier: string, exchangeState = state) =>
			auth.handler(
				new Request("http://localhost:3000/api/auth/electron/token", {
					method: "POST",
					headers: {
						origin: `${DESKTOP_PROTOCOL}:/`,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						token: grant.electron_authorization_code,
						state: exchangeState,
						code_verifier: codeVerifier,
					}),
				})
			);
		expect((await exchange("wrong-verifier")).status).toBe(400);
		expect((await exchange(verifier, "wrong-state")).status).toBe(400);
		const desktop = await exchange(verifier);
		expect(desktop.status).toBe(200);
		expect(desktop.headers.get("set-cookie")).toContain(
			"better-auth.session_token="
		);
		const desktopCookie = desktop.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		const session = await auth.api.getSession({
			headers: new Headers({ cookie: desktopCookie }),
		});
		expect(session?.user.email).toBe("desktop@example.com");
		expect((await exchange(verifier)).status).toBe(404);
	});
});
