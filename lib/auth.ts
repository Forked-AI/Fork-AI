import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, multiSession, organization } from "better-auth/plugins";
import {
	adminAc,
	defaultAc as defaultOrganizationAc,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";
import nodeMailer from "nodemailer";
import Stripe from "stripe";
import { authorizeSubscriptionReference } from "./billing/subscription-reference";
import {
	checkOTPRateLimitByType,
	recordOTPAttemptByType,
} from "./otp-rate-limit";
import { prisma } from "./prisma";
import { logServerError, logServerWarning } from "./server-safe-log";

// Error codes for account status issues
export const AUTH_ERROR_CODES = {
	ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
	ACCOUNT_BANNED: "ACCOUNT_BANNED",
	ACCOUNT_BANNED_TEMPORARY: "ACCOUNT_BANNED_TEMPORARY",
} as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const stripeProMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim();
const stripeProAnnualPriceId = process.env.STRIPE_PRO_ANNUAL_PRICE_ID?.trim();
let stripeSubscriptionPlugin: ReturnType<typeof stripe> | null = null;

const billingAdminAc = defaultOrganizationAc.newRole({
	organization: ["update"],
	member: [],
	invitation: [],
	team: [],
	ac: ["read"],
});

const viewerAc = defaultOrganizationAc.newRole({
	organization: [],
	member: [],
	invitation: [],
	team: [],
	ac: ["read"],
});

if (stripeSecretKey && stripeWebhookSecret && stripeProMonthlyPriceId) {
	const stripeClient = new Stripe(stripeSecretKey, {
		apiVersion: "2026-03-25.dahlia",
	});
	stripeSubscriptionPlugin = stripe({
		stripeClient,
		stripeWebhookSecret,
		createCustomerOnSignup: true,
		subscription: {
			enabled: true,
			requireEmailVerification: true,
			authorizeReference: async (
				{ user, session, referenceId, action },
				ctx
			) =>
				authorizeSubscriptionReference({
					user,
					session,
					referenceId,
					customerType:
						(ctx.body as { customerType?: string } | undefined)
							?.customerType ??
						(ctx.query as { customerType?: string } | undefined)
							?.customerType,
					action,
				}),
			plans: [
				{
					name: "pro",
					priceId: stripeProMonthlyPriceId,
					...(stripeProAnnualPriceId
						? { annualDiscountPriceId: stripeProAnnualPriceId }
						: {}),
					freeTrial: {
						days: parsePositiveInt(process.env.PRO_TRIAL_DAYS, 7),
					},
					limits: {
						monthlyTokens: parsePositiveInt(
							process.env.PRO_MONTHLY_TOKEN_BUDGET,
							10000000
						),
					},
				},
			],
		},
		organization: {
			enabled: true,
		},
	});
} else if (stripeSecretKey || stripeWebhookSecret || stripeProMonthlyPriceId) {
	logServerWarning("auth", "stripe_plugin_disabled");
	/*missing log */
	if (!stripeSecretKey) {
		logServerWarning("auth", "missing_stripe_secret_key");
	}
	if (!stripeWebhookSecret) {
		logServerWarning("auth", "missing_stripe_webhook_secret");
	}
	if (!stripeProMonthlyPriceId) {
		logServerWarning("auth", "missing_stripe_price_id");
	}
}

async function checkAccountStatus(email: string): Promise<{
	isBlocked: boolean;
	errorCode?: string;
	errorMessage?: string;
}> {
	const user = await prisma.user.findUnique({
		where: { email },
		select: {
			id: true,
			banned: true,
			banExpires: true,
			banReason: true,
		},
	});

	if (!user) {
		// User doesn't exist - let the normal flow handle this
		return { isBlocked: false };
	}

	// Check if account is banned
	if (user.banned === true) {
		// Check if it's a temporary ban that hasn't expired
		if (user.banExpires && new Date(user.banExpires) > new Date()) {
			const banExpiryDate = new Date(user.banExpires).toLocaleDateString(
				"en-US",
				{
					year: "numeric",
					month: "long",
					day: "numeric",
				}
			);
			logServerWarning("auth", "blocked_password_reset", {
				reason: "temporary_ban",
				userId: user.id,
			});
			return {
				isBlocked: true,
				errorCode: AUTH_ERROR_CODES.ACCOUNT_BANNED_TEMPORARY,
				errorMessage: `Your account has been banned until ${banExpiryDate}. ${user.banReason ? `Reason: ${user.banReason}` : "Please contact support for more information."}`,
			};
		} else if (user.banExpires && new Date(user.banExpires) <= new Date()) {
			// Ban has expired, allow the action (ban should be cleared separately)
			return { isBlocked: false };
		} else {
			// Permanent ban (no expiry date)
			logServerWarning("auth", "blocked_password_reset", {
				reason: "permanent_ban",
				userId: user.id,
			});
			return {
				isBlocked: true,
				errorCode: AUTH_ERROR_CODES.ACCOUNT_BANNED,
				errorMessage: `Your account has been permanently banned. ${user.banReason ? `Reason: ${user.banReason}` : "Please contact support for more information."}`,
			};
		}
	}

	return { isBlocked: false };
}

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true, // Require email verification for sign-up
		customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
			...coreFields,
			role: "user",
			banned: false,
			banReason: null,
			banExpires: null,
			...additionalFields,
			id,
		}),
		sendResetPassword: async ({
			user,
			url,
			token,
		}: {
			user: { email: string; id: string };
			url: string;
			token: string;
		}) => {
			// Check if account is deactivated or banned before sending password reset
			const accountStatus = await checkAccountStatus(user.email);
			if (accountStatus.isBlocked) {
				throw new Error(accountStatus.errorMessage);
			}

			// Check rate limiting for forgot password requests
			const rateLimitResult = await checkOTPRateLimitByType(
				user.email,
				"forgot-password"
			);

			if (!rateLimitResult.allowed) {
				throw new Error(
					rateLimitResult.message ||
						"Too many password reset requests. Please try again later."
				);
			}

			// Record the attempt
			await recordOTPAttemptByType(user.email, "forgot-password");

			await sendEmail(user.email, url, token);
		},
		resetPasswordTokenExpiresIn: 900, // 15 minutes
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
	plugins: [
		multiSession({
			maximumSessions: 2,
		}),
		admin(),
		organization({
			creatorRole: "owner",
			membershipLimit: parsePositiveInt(
				process.env.ORGANIZATION_MEMBERSHIP_LIMIT,
				100
			),
			invitationLimit: parsePositiveInt(
				process.env.ORGANIZATION_INVITATION_LIMIT,
				100
			),
			roles: {
				owner: ownerAc,
				admin: adminAc,
				member: memberAc,
				billing_admin: billingAdminAc,
				viewer: viewerAc,
			},
		}),
		...(stripeSubscriptionPlugin ? [stripeSubscriptionPlugin] : []),
	],
});

export { auth as default };

// Send verification email using nodemailer
async function sendEmail(to: string, url: string, token: string) {
	// Determine email type based on content
	const isOtp = token.length === 6 && /^\d{6}$/.test(token);
	const isReset = url.includes("reset-password") || token.includes("reset");

	let subject: string;
	let html: string;

	if (isOtp) {
		subject = "Your ForkAI Verification Code";
		html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: linear-gradient(180deg, #0A2727 0%, #0C1110 100%);">
        <div style="text-align: center; padding: 40px 20px 30px;">
          <h1 style="color: #57FCFF; margin: 0 0 10px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">ForkAI</h1>
          <p style="color: #fff; margin: 0; font-size: 18px; opacity: 0.9;">Verification Code</p>
        </div>
        <div style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; padding: 40px 30px; margin: 0 20px 30px; border: 1px solid rgba(87, 252, 255, 0.2);">
          <p style="color: #fff; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; opacity: 0.9;">Hello,</p>
          <p style="color: #fff; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; opacity: 0.9;">Use this verification code to complete your request:</p>
          <div style="background: linear-gradient(135deg, rgba(87, 252, 255, 0.1) 0%, rgba(87, 252, 255, 0.05) 100%); border: 2px solid #57FCFF; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
            <div style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #57FCFF; font-family: 'Courier New', monospace;">
              ${token}
            </div>
          </div>
          <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">⏱️ This code expires in 5 minutes</p>
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; line-height: 1.5; margin: 0;">If you didn't request this code, please ignore this email.</p>
        </div>
      </div>
    `;
	} else if (isReset) {
		subject = "Reset Your ForkAI Password";
		html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: linear-gradient(180deg, #0A2727 0%, #0C1110 100%);">
        <!-- Header -->
        <div style="text-align: center; padding: 40px 20px 30px;">
          <div style="background: linear-gradient(135deg, rgba(87, 252, 255, 0.2) 0%, rgba(87, 252, 255, 0.1) 100%); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(87, 252, 255, 0.3);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H17V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21Z" stroke="#57FCFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 style="color: #57FCFF; margin: 0 0 10px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Password Reset</h1>
          <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 16px;">Reset your ForkAI account password</p>
        </div>
        
        <!-- Main content -->
        <div style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; padding: 40px 30px; margin: 0 20px 30px; border: 1px solid rgba(87, 252, 255, 0.2);">
          <p style="color: #fff; font-size: 18px; line-height: 1.6; margin: 0 0 16px 0; font-weight: 500; opacity: 0.9;">Hello,</p>
          <p style="color: rgba(255, 255, 255, 0.8); font-size: 16px; line-height: 1.8; margin: 0 0 32px 0;">We received a request to reset your password. Click the button below to create a new password:</p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${url}" style="background: linear-gradient(135deg, #57FCFF 0%, #40D4E0 100%); color: #0A2727; padding: 16px 48px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 0 30px rgba(87, 252, 255, 0.4); transition: all 0.3s ease;">Reset Password</a>
          </div>
          
          <!-- Security notice -->
          <div style="background-color: rgba(87, 252, 255, 0.1); border-left: 4px solid #57FCFF; padding: 16px 20px; margin: 32px 0; border-radius: 8px;">
            <p style="color: rgba(255, 255, 255, 0.8); font-size: 14px; line-height: 1.6; margin: 0; display: flex; align-items: center;">
              <span style="font-size: 18px; margin-right: 8px;">⏱️</span>
              <span>This link expires in 15 minutes for security reasons.</span>
            </p>
          </div>
          
          <!-- Warning message -->
          <div style="background-color: rgba(255, 243, 205, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 16px 20px; margin-top: 24px;">
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; line-height: 1.6; margin: 0; display: flex; align-items: start;">
              <span style="font-size: 18px; margin-right: 8px; margin-top: 2px;">⚠️</span>
              <span>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</span>
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px 20px;">
          <p style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.5); font-size: 12px;">Need help? Contact support</p>
          <p style="margin: 0; color: #57FCFF; font-size: 12px; font-weight: 500;">© ${new Date().getFullYear()} ForkAI. All rights reserved.</p>
        </div>
      </div>
    `;
	} else {
		subject = "Welcome to ForkAI – Verify Your Email";
		html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: linear-gradient(180deg, #0A2727 0%, #0C1110 100%);">
        <div style="text-align: center; padding: 40px 20px 30px;">
          <h1 style="color: #57FCFF; margin: 0 0 10px 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">Welcome to ForkAI</h1>
          <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 16px;">Let's verify your email address</p>
        </div>
        <div style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; padding: 40px 30px; margin: 0 20px 30px; border: 1px solid rgba(87, 252, 255, 0.2);">
          <p style="color: #fff; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0; font-weight: 500; opacity: 0.9;">Hello,</p>
          <p style="color: rgba(255, 255, 255, 0.8); font-size: 16px; line-height: 1.8; margin: 0 0 30px 0;">Thank you for joining ForkAI! Click the button below to verify your email and start exploring:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background: linear-gradient(135deg, #57FCFF 0%, #40D4E0 100%); color: #0A2727; padding: 16px 48px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 0 30px rgba(87, 252, 255, 0.4);">Verify Email</a>
          </div>
          <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">If the button doesn't work, copy and paste this link:</p>
          <p style="color: #57FCFF; font-size: 13px; word-break: break-all; margin: 10px 0; padding: 12px; background-color: rgba(87, 252, 255, 0.1); border-radius: 8px; border: 1px solid rgba(87, 252, 255, 0.2);">${url}</p>
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; line-height: 1.5; margin: 0 0 10px 0;">⏱️ This link expires in 1 hour</p>
          <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; line-height: 1.5; margin: 0;">If you didn't create this account, please ignore this email.</p>
        </div>
        <div style="padding: 24px 20px; text-align: center; border-top: 1px solid rgba(87, 252, 255, 0.1);">
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 0 0 8px 0;">Need help? Contact support</p>
          <p style="color: #57FCFF; font-size: 12px; font-weight: 500; margin: 0;">© ${new Date().getFullYear()} ForkAI. All rights reserved.</p>
        </div>
      </div>
    `;
	}

	const transporter = nodeMailer.createTransport({
		host: process.env.SMTP_HOST,
		port: Number(process.env.SMTP_PORT) || 587,
		secure: false,
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		},
	});

	const mailOptions = {
		from: process.env.SMTP_FROM || "noreply@yourdomain.com",
		to,
		subject: subject,
		html: html,
	};

	try {
		await transporter.sendMail(mailOptions);
		// Verification email sent
	} catch (error) {
		// Log error for monitoring
		logServerError("auth", "verification_email_failed", error);
		throw new Error("Failed to send email");
	}
}
