import { getModelRegistrySummary } from "@/lib/ai/model-registry";
import { validatePromptRegistry } from "@/lib/ai/prompt-registry";
import { requireAdminSession } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	return NextResponse.json({
		modelRegistry: getModelRegistrySummary(),
		promptRegistry: {
			models: validatePromptRegistry().map((prompt) => ({
				id: prompt.id,
				version: prompt.version,
				sourcePath: prompt.sourcePath,
				rolloutState: prompt.rolloutState,
				requiredEvalSuites: prompt.requiredEvalSuites,
			})),
		},
	});
}
