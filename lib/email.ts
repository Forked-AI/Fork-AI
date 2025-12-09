import WaitlistWelcomeEmail from "@/emails/waitlist-welcome";
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
      console.error("Failed to send welcome email:", error);
      return { success: false, error };
    }

    console.log("Welcome email sent:", data?.id);
    return { success: true, data };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, error };
  }
}
