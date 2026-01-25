import { createClient } from "redis";

// Use global to persist across module re-evaluations (Next.js hot reload)
declare global {
	// eslint-disable-next-line no-var
	var __redisClient: any | undefined;
	// eslint-disable-next-line no-var
	var __redisInitialized: boolean | undefined;
	// eslint-disable-next-line no-var
	var __redisHasLoggedConnect: boolean | undefined;
	// eslint-disable-next-line no-var
	var __redisHasLoggedReady: boolean | undefined;
}

// Singleton pattern: Only create Redis client once, even across hot reloads
let redisClient: any = null;

// Check if we already have a client in the global scope
if (global.__redisClient) {
	redisClient = global.__redisClient;
} else if (
	process.env.REDIS_URL &&
	process.env.REDIS_URL !== "redis://localhost:6379" &&
	!global.__redisInitialized
) {
	// Mark as initialized to prevent multiple connections
	global.__redisInitialized = true;

	redisClient = createClient({
		url: process.env.REDIS_URL,
	});

	// Only set up event listeners once
	redisClient.on("error", (err: Error) => {
		// eslint-disable-next-line no-console
		console.error("Redis Client Error", err);
	});

	// Suppress connection messages after first connection (using global flags)
	redisClient.on("connect", () => {
		if (!global.__redisHasLoggedConnect) {
			// eslint-disable-next-line no-console
			console.log("Redis connected successfully");
			global.__redisHasLoggedConnect = true;
		}
	});

	redisClient.on("ready", () => {
		if (!global.__redisHasLoggedReady) {
			// eslint-disable-next-line no-console
			console.log("Redis client ready");
			global.__redisHasLoggedReady = true;
		}
	});

	// Connect with better error handling
	redisClient.connect().catch((err: Error) => {
		// eslint-disable-next-line no-console
		console.error("Failed to connect to Redis:", err);
		global.__redisInitialized = false; // Allow retry on failure
		global.__redisClient = null; // Clear on failure
	});

	// Store in global for persistence across hot reloads
	global.__redisClient = redisClient;
} else if (
	!process.env.REDIS_URL ||
	process.env.REDIS_URL === "redis://localhost:6379"
) {
	// Only log once if Redis is not configured
	if (!global.__redisInitialized && process.env.NODE_ENV === "development") {
		// eslint-disable-next-line no-console
		console.log("Redis not configured - using memory-only session storage");
		global.__redisInitialized = true;
	}
}

export { redisClient };
