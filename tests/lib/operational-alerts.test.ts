import {
	evaluateMetricAlerts,
	evaluateQueueAlerts,
} from "@/lib/operational-alerts";
import { describe, expect, it } from "vitest";

describe("operational alert evaluation", () => {
	it("raises provider failure, 429, and cost alerts", () => {
		const alerts = evaluateMetricAlerts({
			generationCount: 20,
			failureCount: 8,
			provider429Count: 4,
			costTotal: 120,
		});

		expect(alerts.map((alert) => alert.code)).toEqual([
			"PROVIDER_FAILURE_RATE_HIGH",
			"PROVIDER_429_RATE_HIGH",
			"COST_WINDOW_HIGH",
		]);
	});

	it("raises queue backlog and failed-job alerts", () => {
		const alerts = evaluateQueueAlerts([
			{
				name: "conversation",
				counts: { waiting: 90, delayed: 20, failed: 12 },
			},
		]);

		expect(alerts.map((alert) => alert.code)).toEqual([
			"QUEUE_BACKLOG_HIGH:conversation",
			"QUEUE_FAILURES_HIGH:conversation",
		]);
	});
});
