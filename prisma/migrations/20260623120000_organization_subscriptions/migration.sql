-- Better Auth Stripe organization subscriptions.
-- `subscription.referenceId` remains non-unique so canceled references can
-- resubscribe, while this partial index prevents concurrent current plans.

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_stripeCustomerId_key"
  ON "organization"("stripeCustomerId");

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_stripeSubscriptionId_key"
  ON "subscription"("stripeSubscriptionId");

CREATE INDEX IF NOT EXISTS "subscription_referenceId_status_idx"
  ON "subscription"("referenceId", "status");

CREATE INDEX IF NOT EXISTS "subscription_stripeCustomerId_idx"
  ON "subscription"("stripeCustomerId");

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_active_referenceId_key"
  ON "subscription"("referenceId")
  WHERE "status" IN ('active', 'trialing', 'past_due');
