import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Custom hook for handling user logout functionality
 * Provides a consistent logout experience across the application
 */
export function useLogout() {
	const router = useRouter();

	const logout = useCallback(async () => {
		try {
			// Sign out the user
			await authClient.signOut();

			// Clear any local storage data that might persist
			if (typeof window !== "undefined") {
				// Clear conversation-related data
				localStorage.removeItem("conversations");
				localStorage.removeItem("currentConversation");
				localStorage.removeItem("chatSettings");

				// Clear any session storage
				sessionStorage.clear();
			}

			// Redirect to home page
			router.push("/");

			// Force a page refresh to ensure all state is cleared
			// This helps prevent any cached authentication state
			window.location.href = "/";
		} catch (error) {
			console.error("Logout failed:", error);

			// Even if logout fails, still redirect to clear local state
			router.push("/");
			window.location.href = "/";
		}
	}, [router]);

	return { logout };
}
