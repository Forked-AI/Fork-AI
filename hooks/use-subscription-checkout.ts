import { useToast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

interface BetterAuthError {
	message?: string;
}

interface BetterAuthResult<TData = unknown> {
	data?: TData;
	error?: BetterAuthError | null;
}

interface RedirectPayload {
	url?: string;
	redirect?: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return fallback;
}

function getRedirectUrl(data: unknown): string | null {
	if (!data) return null;
	if (typeof data === "string") return data;
	if (typeof data === "object" && "url" in data && typeof data.url === "string") {
		return data.url;
	}
	return null;
}

function getSubscriptionClient() {
	return (authClient as unknown as {
		subscription?: {
			upgrade?: (payload: Record<string, unknown>) => Promise<BetterAuthResult<RedirectPayload>>;
			upgradeSubscription?: (payload: Record<string, unknown>) => Promise<BetterAuthResult<RedirectPayload>>;
		};
	}).subscription;
}

export function useSubscriptionCheckout() {
	const { toast } = useToast();
	const [isCheckingOut, setIsCheckingOut] = useState(false);

	const startUpgrade = async (annual: boolean) => {
		setIsCheckingOut(true);

		try {
			const subscriptionClient = getSubscriptionClient();
			const upgradeMethod = subscriptionClient?.upgrade ?? subscriptionClient?.upgradeSubscription;

			if (typeof upgradeMethod !== "function") {
				throw new Error("Subscription checkout is unavailable right now. Please try again later.");
			}

			const baseUrl = window.location.origin;
			const billingPageUrl = `${baseUrl}/chat/billing`;
			const successUrl = `${billingPageUrl}?checkout=success`;
			const cancelUrl = `${billingPageUrl}?checkout=canceled`;

			const result = await upgradeMethod({
				plan: "pro",
				annual,
				successUrl,
				cancelUrl,
				returnUrl: billingPageUrl,
				disableRedirect: true,
			});

			if (result?.error?.message) {
				throw new Error(result.error.message);
			}

			const redirectUrl = getRedirectUrl(result?.data);
			if (!redirectUrl) {
				throw new Error("Checkout URL was not returned. Please try again in a moment.");
			}

			window.location.assign(redirectUrl);
		} catch (error) {
			toast({
				title: "Unable to start checkout",
				description: getErrorMessage(error, "We could not start Stripe checkout. Please try again."),
				variant: "destructive",
			});
			setIsCheckingOut(false);
		}
	};

	return { startUpgrade, isCheckingOut };
}
