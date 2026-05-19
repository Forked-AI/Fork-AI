import { createClient } from "redis";
import {
	logServerError,
	logServerInfo,
	logServerWarning,
} from "./server-safe-log";

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
		logServerError("redis", "client_error", err);
	});

	// Suppress connection messages after first connection (using global flags)
	redisClient.on("connect", () => {
		if (!global.__redisHasLoggedConnect) {
			logServerInfo("redis", "connected");
			global.__redisHasLoggedConnect = true;
		}
	});

	redisClient.on("ready", () => {
		if (!global.__redisHasLoggedReady) {
			logServerInfo("redis", "ready");
			global.__redisHasLoggedReady = true;
		}
	});

	// Connect with better error handling
	redisClient.connect().catch((err: Error) => {
		logServerError("redis", "connect_failed", err);
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
		logServerWarning("redis", "not_configured");
		global.__redisInitialized = true;
	}
}

export { redisClient };
