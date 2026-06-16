export type OperationalAlertSeverity = "warning" | "critical";

export interface OperationalAlert {
	code: string;
	severity: OperationalAlertSeverity;
	title: string;
	value: number;
	threshold: number;
	unit: "count" | "percent" | "usd";
}

function envNumber(name: string, fallback: number, minimum = 0) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value >= minimum ? value : fallback;
}

export function evaluateMetricAlerts(input: {
	generationCount: number;
	failureCount: number;
	provider429Count: number;
	costTotal: number;
}): OperationalAlert[] {
	const alerts: OperationalAlert[] = [];
	const minimumRequests = envNumber("ALERT_PROVIDER_MIN_REQUESTS", 10, 1);
	const failureRateThreshold = envNumber(
		"ALERT_PROVIDER_FAILURE_RATE_PERCENT",
		25,
		1
	);
	const rateLimitThreshold = envNumber(
		"ALERT_PROVIDER_429_RATE_PERCENT",
		15,
		1
	);
	const costThreshold = envNumber("ALERT_COST_WINDOW_USD", 100, 0.01);
	const failureRate =
		input.generationCount > 0
			? (input.failureCount / input.generationCount) * 100
			: 0;
	const provider429Rate =
		input.generationCount > 0
			? (input.provider429Count / input.generationCount) * 100
			: 0;

	if (
		input.generationCount >= minimumRequests &&
		failureRate >= failureRateThreshold
	) {
		alerts.push({
			code: "PROVIDER_FAILURE_RATE_HIGH",
			severity: failureRate >= 50 ? "critical" : "warning",
			title: "Provider failure rate is elevated",
			value: failureRate,
			threshold: failureRateThreshold,
			unit: "percent",
		});
	}
	if (
		input.generationCount >= minimumRequests &&
		provider429Rate >= rateLimitThreshold
	) {
		alerts.push({
			code: "PROVIDER_429_RATE_HIGH",
			severity: provider429Rate >= 35 ? "critical" : "warning",
			title: "Provider rate limiting is elevated",
			value: provider429Rate,
			threshold: rateLimitThreshold,
			unit: "percent",
		});
	}
	if (input.costTotal >= costThreshold) {
		alerts.push({
			code: "COST_WINDOW_HIGH",
			severity:
				input.costTotal >= costThreshold * 2 ? "critical" : "warning",
			title: "AI cost exceeded the monitoring window threshold",
			value: input.costTotal,
			threshold: costThreshold,
			unit: "usd",
		});
	}

	return alerts;
}

export function evaluateQueueAlerts(
	queues: Array<{
		name: string;
		counts: Record<string, number>;
	}>
): OperationalAlert[] {
	const backlogThreshold = envNumber("ALERT_QUEUE_BACKLOG_COUNT", 100, 1);
	const failedThreshold = envNumber("ALERT_QUEUE_FAILED_COUNT", 10, 1);
	const alerts: OperationalAlert[] = [];

	for (const queue of queues) {
		const backlog =
			(queue.counts.waiting ?? 0) + (queue.counts.delayed ?? 0);
		const failed = queue.counts.failed ?? 0;
		if (backlog >= backlogThreshold) {
			alerts.push({
				code: `QUEUE_BACKLOG_HIGH:${queue.name}`,
				severity:
					backlog >= backlogThreshold * 2 ? "critical" : "warning",
				title: `${queue.name} queue backlog is elevated`,
				value: backlog,
				threshold: backlogThreshold,
				unit: "count",
			});
		}
		if (failed >= failedThreshold) {
			alerts.push({
				code: `QUEUE_FAILURES_HIGH:${queue.name}`,
				severity:
					failed >= failedThreshold * 2 ? "critical" : "warning",
				title: `${queue.name} queue has too many failed jobs`,
				value: failed,
				threshold: failedThreshold,
				unit: "count",
			});
		}
	}

	return alerts;
}
