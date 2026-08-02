import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("subscription schema constraints", () => {
	it("keeps Better Auth reference IDs reusable while constraining active subscriptions", () => {
		const schema = readFileSync("prisma/schema.prisma", "utf8");
		const migration = readFileSync(
			"prisma/migrations/20260623120000_organization_subscriptions/migration.sql",
			"utf8"
		);

		expect(schema).not.toContain("@@unique([referenceId])");
		expect(schema).toContain("@@unique([stripeSubscriptionId])");
		expect(schema).toContain("@@index([referenceId, status])");
		expect(migration).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS "subscription_active_referenceId_key"'
		);
		expect(migration).toContain(
			"WHERE \"status\" IN ('active', 'trialing', 'past_due')"
		);
	});
});
