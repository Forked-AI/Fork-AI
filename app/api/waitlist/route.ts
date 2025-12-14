import { sendWelcomeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const emailSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

export async function POST(request: Request) {
	try {
		const body = await request.json();

		// Validate email
		const result = emailSchema.safeParse(body);
		if (!result.success) {
			return NextResponse.json(
				{ error: result.error.errors[0].message },
				{ status: 400 }
			);
		}

		const { email } = result.data;

		// Check if email already exists
		const existingEntry = await prisma.waitlistEntry.findUnique({
			where: { email },
		});

		if (existingEntry) {
			return NextResponse.json(
				{ error: "This email is already on the waitlist!" },
				{ status: 409 }
			);
		}

		// Create new entry
		await prisma.waitlistEntry.create({
			data: { email },
		});

		// Send welcome email (don't fail the request if email fails)
		sendWelcomeEmail(email).catch((error) => {
			console.error("Failed to send welcome email:", error);
		});

		return NextResponse.json(
			{ message: "Successfully joined the waitlist!" },
			{ status: 201 }
		);
	} catch (error) {
		console.error("Waitlist signup error:", error);
		return NextResponse.json(
			{ error: "Something went wrong. Please try again later." },
			{ status: 500 }
		);
	}
}
