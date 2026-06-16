import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import { RATE_LIMIT_CONSTANTS } from "@/lib/constants";

export async function checkSkillMutationRateLimit(
	request: Request,
	userId: string,
	action: string
) {
	return checkRequestRateLimit(request, {
		bucket: "skill-mutation",
		maxRequests: RATE_LIMIT_CONSTANTS.MAX_SKILL_MUTATIONS_PER_MINUTE,
		windowSeconds: 60,
		identityParts: [userId, action],
		error: "Too many skill changes. Please wait and try again.",
		errorCode: "SKILL_RATE_LIMIT_EXCEEDED",
		scope: `skills/${action}`,
	});
}
