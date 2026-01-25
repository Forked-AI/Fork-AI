import { redisClient } from "./redis";

interface OTPAttemptInfo {
	count: number;
	firstAttempt: number;
	lastAttempt: number;
	blockedUntil?: number;
}

interface RateLimitResult {
	allowed: boolean;
	attemptsRemaining: number;
	resetTime?: number;
	message?: string;
}

// Different OTP types with their own rate limits
export type OTPType = "signup" | "forgot-password" | "email-verification";

const OTP_LIMITS = {
	signup: {
		maxAttempts: 5,
		cooldownPeriod: 24 * 60 * 60 * 1000, // 24 hours
		resetWindow: 24 * 60 * 60 * 1000, // 24 hours
	},
	"forgot-password": {
		maxAttempts: 5,
		cooldownPeriod: 24 * 60 * 60 * 1000, // 24 hours
		resetWindow: 24 * 60 * 60 * 1000, // 24 hours
	},
	"email-verification": {
		maxAttempts: 5,
		cooldownPeriod: 1 * 60 * 60 * 1000, // 1 hour (less restrictive for email verification)
		resetWindow: 1 * 60 * 60 * 1000, // 1 hour
	},
};

// Legacy constants for backward compatibility
const MAX_ATTEMPTS = 5;
const COOLDOWN_PERIOD = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const RESET_WINDOW = 24 * 60 * 60 * 1000; // 24 hours window for attempt counting

/**
 * Check if an email can send OTP based on rate limiting rules for specific type
 * @param email - User's email address
 * @param otpType - Type of OTP (signup, forgot-password, email-verification)
 * @returns Promise<RateLimitResult> - Information about rate limit status
 */
export async function checkOTPRateLimitByType(
	email: string,
	otpType: OTPType
): Promise<RateLimitResult> {
	try {
		const limits = OTP_LIMITS[otpType];
		const key = `otp_attempts:${otpType}:${email.toLowerCase()}`;
		const attemptDataStr = await redisClient.get(key);

		const now = Date.now();

		// If no previous attempts, allow
		if (!attemptDataStr) {
			return {
				allowed: true,
				attemptsRemaining: limits.maxAttempts - 1,
				message: "OTP request allowed",
			};
		}

		const attemptData: OTPAttemptInfo = JSON.parse(attemptDataStr);

		// Check if user is currently blocked
		if (attemptData.blockedUntil && now < attemptData.blockedUntil) {
			const remainingTime = attemptData.blockedUntil - now;
			const hoursRemaining = Math.ceil(remainingTime / (60 * 60 * 1000));

			return {
				allowed: false,
				attemptsRemaining: 0,
				resetTime: attemptData.blockedUntil,
				message: `Too many ${otpType} OTP requests. Please try again in ${hoursRemaining} hour(s).`,
			};
		}

		// Check if we need to reset the window
		if (now - attemptData.firstAttempt > limits.resetWindow) {
			// Reset the attempts window
			await redisClient.del(key);
			return {
				allowed: true,
				attemptsRemaining: limits.maxAttempts - 1,
				message: "OTP request allowed (window reset)",
			};
		}

		// Check if max attempts reached
		if (attemptData.count >= limits.maxAttempts) {
			// Block the user for the cooldown period
			const blockedUntil = now + limits.cooldownPeriod;
			const updatedData: OTPAttemptInfo = {
				...attemptData,
				blockedUntil,
			};

			await redisClient.setEx(
				key,
				Math.ceil(limits.cooldownPeriod / 1000),
				JSON.stringify(updatedData)
			);

			const hoursRemaining = Math.ceil(
				limits.cooldownPeriod / (60 * 60 * 1000)
			);
			return {
				allowed: false,
				attemptsRemaining: 0,
				resetTime: blockedUntil,
				message: `Maximum ${otpType} OTP requests reached. Please try again in ${hoursRemaining} hours.`,
			};
		}

		// Allow the request
		return {
			allowed: true,
			attemptsRemaining: limits.maxAttempts - attemptData.count - 1,
			message: `OTP request allowed. ${limits.maxAttempts - attemptData.count - 1} attempts remaining.`,
		};
	} catch (error) {
		// Log error for monitoring but don't expose details to user
		// console.error("Error checking OTP rate limit:", error);
		// On error, allow the request but log the issue
		return {
			allowed: true,
			attemptsRemaining: OTP_LIMITS[otpType].maxAttempts,
			message: "Rate limit check failed, allowing request",
		};
	}
}

/**
 * Legacy function - Check if an email can send OTP based on rate limiting rules
 * @param email - User's email address
 * @returns Promise<RateLimitResult> - Information about rate limit status
 */
export async function checkOTPRateLimit(
	email: string
): Promise<RateLimitResult> {
	try {
		const key = `otp_attempts:${email.toLowerCase()}`;
		const attemptDataStr = await redisClient.get(key);

		const now = Date.now();

		// If no previous attempts, allow
		if (!attemptDataStr) {
			return {
				allowed: true,
				attemptsRemaining: MAX_ATTEMPTS - 1,
				message: "OTP request allowed",
			};
		}

		const attemptData: OTPAttemptInfo = JSON.parse(attemptDataStr);

		// Check if user is currently blocked
		if (attemptData.blockedUntil && now < attemptData.blockedUntil) {
			const remainingTime = attemptData.blockedUntil - now;
			const hoursRemaining = Math.ceil(remainingTime / (60 * 60 * 1000));

			return {
				allowed: false,
				attemptsRemaining: 0,
				resetTime: attemptData.blockedUntil,
				message: `Too many OTP requests. Please try again in ${hoursRemaining} hour(s).`,
			};
		}

		// Check if we need to reset the window (24 hours passed since first attempt)
		if (now - attemptData.firstAttempt > RESET_WINDOW) {
			// Reset the attempts window
			await redisClient.del(key);
			return {
				allowed: true,
				attemptsRemaining: MAX_ATTEMPTS - 1,
				message: "OTP request allowed (window reset)",
			};
		}

		// Check if max attempts reached
		if (attemptData.count >= MAX_ATTEMPTS) {
			// Block the user for 24 hours
			const blockedUntil = now + COOLDOWN_PERIOD;
			const updatedData: OTPAttemptInfo = {
				...attemptData,
				blockedUntil,
			};

			await redisClient.setEx(
				key,
				Math.ceil(COOLDOWN_PERIOD / 1000),
				JSON.stringify(updatedData)
			);

			const hoursRemaining = Math.ceil(
				COOLDOWN_PERIOD / (60 * 60 * 1000)
			);
			return {
				allowed: false,
				attemptsRemaining: 0,
				resetTime: blockedUntil,
				message: `Maximum OTP requests reached. Please try again in ${hoursRemaining} hours.`,
			};
		}

		// Allow the request
		return {
			allowed: true,
			attemptsRemaining: MAX_ATTEMPTS - attemptData.count - 1,
			message: `OTP request allowed. ${MAX_ATTEMPTS - attemptData.count - 1} attempts remaining.`,
		};
	} catch (error) {
		// Log error for monitoring but don't expose details to user
		// console.error("Error checking OTP rate limit:", error);
		// On error, allow the request but log the issue
		return {
			allowed: true,
			attemptsRemaining: MAX_ATTEMPTS,
			message: "Rate limit check failed, allowing request",
		};
	}
}

/**
 * Record an OTP attempt for an email address by type
 * @param email - User's email address
 * @param otpType - Type of OTP (signup, forgot-password, email-verification)
 * @returns Promise<void>
 */
export async function recordOTPAttemptByType(
	email: string,
	otpType: OTPType
): Promise<void> {
	try {
		const limits = OTP_LIMITS[otpType];
		const key = `otp_attempts:${otpType}:${email.toLowerCase()}`;
		const attemptDataStr = await redisClient.get(key);

		const now = Date.now();

		if (!attemptDataStr) {
			// First attempt
			const newData: OTPAttemptInfo = {
				count: 1,
				firstAttempt: now,
				lastAttempt: now,
			};

			await redisClient.setEx(
				key,
				Math.ceil(limits.resetWindow / 1000),
				JSON.stringify(newData)
			);
		} else {
			const attemptData: OTPAttemptInfo = JSON.parse(attemptDataStr);

			// Check if we need to reset the window
			if (now - attemptData.firstAttempt > limits.resetWindow) {
				// Reset and start fresh
				const newData: OTPAttemptInfo = {
					count: 1,
					firstAttempt: now,
					lastAttempt: now,
				};

				await redisClient.setEx(
					key,
					Math.ceil(limits.resetWindow / 1000),
					JSON.stringify(newData)
				);
			} else {
				// Increment existing count
				const updatedData: OTPAttemptInfo = {
					...attemptData,
					count: attemptData.count + 1,
					lastAttempt: now,
				};

				// Determine TTL based on whether user will be blocked
				const ttl =
					updatedData.count >= limits.maxAttempts
						? Math.ceil(limits.cooldownPeriod / 1000)
						: Math.ceil(
								(attemptData.firstAttempt +
									limits.resetWindow -
									now) /
									1000
							);

				await redisClient.setEx(key, ttl, JSON.stringify(updatedData));
			}
		}
	} catch (error) {
		// Log error for monitoring
		// console.error("Error recording OTP attempt:", error);
	}
}

/**
 * Legacy function - Record an OTP attempt for an email address
 * @param email - User's email address
 * @returns Promise<void>
 */
export async function recordOTPAttempt(email: string): Promise<void> {
	try {
		const key = `otp_attempts:${email.toLowerCase()}`;
		const attemptDataStr = await redisClient.get(key);

		const now = Date.now();

		if (!attemptDataStr) {
			// First attempt
			const newData: OTPAttemptInfo = {
				count: 1,
				firstAttempt: now,
				lastAttempt: now,
			};

			await redisClient.setEx(
				key,
				Math.ceil(RESET_WINDOW / 1000),
				JSON.stringify(newData)
			);
		} else {
			const attemptData: OTPAttemptInfo = JSON.parse(attemptDataStr);

			// Check if we need to reset the window
			if (now - attemptData.firstAttempt > RESET_WINDOW) {
				// Reset and start fresh
				const newData: OTPAttemptInfo = {
					count: 1,
					firstAttempt: now,
					lastAttempt: now,
				};

				await redisClient.setEx(
					key,
					Math.ceil(RESET_WINDOW / 1000),
					JSON.stringify(newData)
				);
			} else {
				// Increment existing count
				const updatedData: OTPAttemptInfo = {
					...attemptData,
					count: attemptData.count + 1,
					lastAttempt: now,
				};

				// Determine TTL based on whether user will be blocked
				const ttl =
					updatedData.count >= MAX_ATTEMPTS
						? Math.ceil(COOLDOWN_PERIOD / 1000)
						: Math.ceil(
								(attemptData.firstAttempt +
									RESET_WINDOW -
									now) /
									1000
							);

				await redisClient.setEx(key, ttl, JSON.stringify(updatedData));
			}
		}
	} catch (error) {
		// Log error for monitoring
		// console.error("Error recording OTP attempt:", error);
	}
}

/**
 * Get current OTP attempt information for an email by type
 * @param email - User's email address
 * @param otpType - Type of OTP (signup, forgot-password, email-verification)
 * @returns Promise<OTPAttemptInfo | null>
 */
export async function getOTPAttemptInfoByType(
	email: string,
	otpType: OTPType
): Promise<OTPAttemptInfo | null> {
	try {
		const key = `otp_attempts:${otpType}:${email.toLowerCase()}`;
		const attemptDataStr = await redisClient.get(key);

		if (!attemptDataStr) {
			return null;
		}

		return JSON.parse(attemptDataStr);
	} catch (error) {
		// Log error for monitoring
		// console.error("Error getting OTP attempt info:", error);
		return null;
	}
}

/**
 * Legacy function - Get current OTP attempt information for an email
 * @param email - User's email address
 * @returns Promise<OTPAttemptInfo | null>
 */
export async function getOTPAttemptInfo(
	email: string
): Promise<OTPAttemptInfo | null> {
	try {
		const key = `otp_attempts:${email.toLowerCase()}`;
		const attemptDataStr = await redisClient.get(key);

		if (!attemptDataStr) {
			return null;
		}

		return JSON.parse(attemptDataStr);
	} catch (error) {
		// Log error for monitoring
		// console.error("Error getting OTP attempt info:", error);
		return null;
	}
}

/**
 * Clear OTP attempts for an email by type (useful for testing or admin actions)
 * @param email - User's email address
 * @param otpType - Type of OTP (signup, forgot-password, email-verification)
 * @returns Promise<void>
 */
export async function clearOTPAttemptsByType(
	email: string,
	otpType: OTPType
): Promise<void> {
	try {
		const key = `otp_attempts:${otpType}:${email.toLowerCase()}`;
		await redisClient.del(key);
	} catch (error) {
		// Log error for monitoring
		// console.error("Error clearing OTP attempts:", error);
	}
}

/**
 * Legacy function - Clear OTP attempts for an email (useful for testing or admin actions)
 * @param email - User's email address
 * @returns Promise<void>
 */
export async function clearOTPAttempts(email: string): Promise<void> {
	try {
		const key = `otp_attempts:${email.toLowerCase()}`;
		await redisClient.del(key);
	} catch (error) {
		// Log error for monitoring
		// console.error("Error clearing OTP attempts:", error);
	}
}

/**
 * Get human-readable time remaining for cooldown
 * @param resetTime - Timestamp when cooldown ends
 * @returns string - Human readable time remaining
 */
export function getTimeRemaining(resetTime: number): string {
	const now = Date.now();
	const remaining = resetTime - now;

	if (remaining <= 0) {
		return "Cooldown expired";
	}

	const hours = Math.floor(remaining / (60 * 60 * 1000));
	const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else {
		return `${minutes}m`;
	}
}
