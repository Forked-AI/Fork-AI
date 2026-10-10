import { electronProxyClient } from "@better-auth/electron/proxy";
import { stripeClient } from "@better-auth/stripe/client";
import { createAuthClient } from "better-auth/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import {
	DESKTOP_AUTH_CALLBACK,
	DESKTOP_CLIENT_ID,
	DESKTOP_PROTOCOL,
} from "./desktop-config";

const publicAuthBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim();

export const authClient = createAuthClient({
	// Same-origin is the default for this app. Only set baseURL when an explicit
	// browser-visible override is needed for a separate auth origin.
	...(publicAuthBaseUrl ? { baseURL: publicAuthBaseUrl } : {}),
	plugins: [
		electronProxyClient({
			clientID: DESKTOP_CLIENT_ID,
			protocol: DESKTOP_PROTOCOL,
			callbackPath: DESKTOP_AUTH_CALLBACK,
		}),
		adminClient(),
		organizationClient(),
		stripeClient({
			subscription: true,
		}),
		// inferAdditionalFields({
		// 	user: {
		// 		role: {
		// 			type: "string",
		// 			required: true,
		// 		},
		// 	},
		// }),
	],
});
