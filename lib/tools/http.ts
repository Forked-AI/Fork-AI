import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import { RATE_LIMIT_CONSTANTS } from "@/lib/constants";

export function checkToolExecuteRateLimit(request: Request, userId: string) {
	return checkRequestRateLimit(request, {
		bucket: "tool-execute",
		maxRequests: RATE_LIMIT_CONSTANTS.MAX_TOOL_EXECUTIONS_PER_MINUTE,
		windowSeconds: 60,
		identityParts: [userId],
		error: "Too many tool executions. Please wait and try again.",
		errorCode: "TOOL_RATE_LIMIT_EXCEEDED",
		scope: "tools/execute",
	});
}

export function checkToolDecisionRateLimit(
	request: Request,
	userId: string,
	action: "confirm" | "cancel"
) {
	return checkRequestRateLimit(request, {
		bucket: "tool-decision",
		maxRequests: RATE_LIMIT_CONSTANTS.MAX_TOOL_DECISIONS_PER_MINUTE,
		windowSeconds: 60,
		identityParts: [userId, action],
		error: "Too many tool confirmation requests. Please wait and try again.",
		errorCode: "TOOL_DECISION_RATE_LIMIT_EXCEEDED",
		scope: `tools/${action}`,
	});
}
