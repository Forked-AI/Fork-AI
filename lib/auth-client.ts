import { stripeClient } from "@better-auth/stripe/client";
import { createAuthClient } from "better-auth/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";

const publicAuthBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim();

export const authClient = createAuthClient({
	// Same-origin is the default for this app. Only set baseURL when an explicit
	// browser-visible override is needed for a separate auth origin.
	...(publicAuthBaseUrl ? { baseURL: publicAuthBaseUrl } : {}),
	plugins: [
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
