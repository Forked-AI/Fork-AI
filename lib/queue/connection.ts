import type { ConnectionOptions } from "bullmq";

const redisUrl =
	process.env.REDIS_URL ??
	(process.env.NODE_ENV === "production" ? undefined : "redis://localhost:6379");

if (!redisUrl) {
	throw new Error("REDIS_URL is required for BullMQ queues");
}

export const queueConnection: ConnectionOptions = {
	url: redisUrl,
};
