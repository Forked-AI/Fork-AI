import {
	DESKTOP_AUTH_CALLBACK,
	DESKTOP_CLIENT_ID,
	DESKTOP_PROTOCOL,
} from "@/lib/desktop-config";

export const dynamic = "force-dynamic";

// Public compatibility information only; never return credentials or sessions.
export function GET() {
	return Response.json(
		{
			version: 1,
			clientID: DESKTOP_CLIENT_ID,
			protocol: DESKTOP_PROTOCOL,
			callbackPath: DESKTOP_AUTH_CALLBACK,
		},
		{ headers: { "Cache-Control": "no-store" } }
	);
}
