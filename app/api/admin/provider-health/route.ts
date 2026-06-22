import {
	getProviderCapabilityProfiles,
	getProviderHealthRows,
} from "@/lib/ai/gateway/registry";
import { requireAdminSession } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	return NextResponse.json({
		providers: getProviderCapabilityProfiles(),
		models: getProviderHealthRows(),
	});
}
