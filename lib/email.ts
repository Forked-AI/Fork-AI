import WaitlistWelcomeEmail from "@/emails/waitlist-welcome";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(email: string) {
	try {
		const { data, error } = await resend.emails.send({
			from: process.env.EMAIL_FROM || "Fork.AI <onboarding@resend.dev>",
			to: email,
			subject: "Welcome to Fork.AI Early Access! 🚀",
			react: WaitlistWelcomeEmail({ email }),
		});

		if (error) {
			logServerError("email", "welcome_send_failed", error);
			return { success: false, error };
		}

		logServerInfo("email", "welcome_sent", {
			providerMessageId: data?.id ?? null,
		});
		return { success: true, data };
	} catch (error) {
		logServerError("email", "welcome_send_failed", error);
		return { success: false, error };
	}
}
