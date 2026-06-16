import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import { RATE_LIMIT_CONSTANTS } from "@/lib/constants";
import { recordAbuseSignal } from "@/lib/moderation/moderation-service";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";
import { z } from "zod";

const emailSchema = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.email("Enter a valid email address."),
});

export async function POST(request: Request) {
	try {
		const rateLimit = await checkRequestRateLimit(request, {
			bucket: "signup-availability",
			maxRequests:
				RATE_LIMIT_CONSTANTS.MAX_SIGNUP_AVAILABILITY_PER_MINUTE,
			windowSeconds: 60,
			error: "Too many availability checks. Please try again later.",
			errorCode: "SIGNUP_AVAILABILITY_RATE_LIMIT_EXCEEDED",
			scope: "signup/availability",
		});
		if (!rateLimit.allowed) {
			await recordAbuseSignal({
				signalType: "suspicious_signup",
				severity: "medium",
				action: "degrade",
				actorHash: rateLimit.identityHash,
				windowSeconds: 60,
				metadata: {
					bucket: "signup-availability",
					retryAfterSeconds: rateLimit.state.retryAfterSeconds,
				},
			});
			return rateLimit.response;
		}

		const body = await request.json();
		const result = emailSchema.safeParse(body);

		if (!result.success) {
			return NextResponse.json(
				{
					available: false,
					error:
						result.error.errors[0]?.message ??
						"Enter a valid email address.",
				},
				{ status: 400 }
			);
		}

		const { email } = result.data;
		const existingUser = await prisma.user.findFirst({
			where: {
				email: {
					equals: email,
					mode: "insensitive",
				},
			},
			select: { id: true },
		});

		if (existingUser) {
			return NextResponse.json(
				{
					available: false,
					error: "This email is already registered. Use another email or sign in.",
				},
				{ status: 409 }
			);
		}

		return NextResponse.json({ available: true }, { status: 200 });
	} catch (error) {
		logServerError("signup/availability", "check_failed", error);
		return NextResponse.json(
			{ available: false, error: "Couldn't verify email right now." },
			{ status: 500 }
		);
	}
}
