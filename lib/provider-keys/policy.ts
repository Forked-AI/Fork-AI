export const BYOK_POLICY_VERSION = "byok-policy-v1";

export const byokCredentialRequirements = {
	version: BYOK_POLICY_VERSION,
	storage: "encrypted-at-rest",
	plaintextAllowedInLogs: false,
	plaintextAllowedInPrompts: false,
	exportBehavior: "metadata-only",
	deleteBehavior: "revoke-and-delete",
	rotationRequired: true,
	revocationRequired: true,
	lastUsedMetadataRequired: true,
	usageAttributionRequired: true,
};

export function assertProviderKeyCanBePersisted(input: {
	encrypted: boolean;
	provider: string;
	scope: "user" | "organization";
}) {
	if (!input.encrypted) {
		return {
			ok: false as const,
			errorCode: "PROVIDER_KEY_MUST_BE_ENCRYPTED",
		};
	}
	if (!input.provider || !input.scope) {
		return {
			ok: false as const,
			errorCode: "PROVIDER_KEY_SCOPE_REQUIRED",
		};
	}
	return { ok: true as const };
}
