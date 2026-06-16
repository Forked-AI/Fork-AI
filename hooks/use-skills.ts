"use client";

import { createIdempotencyHeaders } from "@/lib/idempotency-client";
import type {
	CreateSkillTemplateInput,
	InstalledSkillView,
	SkillCollectionView,
	SkillActivationScope,
	SkillTemplate,
} from "@/lib/skills/catalog";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface ConversationSkillBindingView {
	id: string;
	scope: "conversation";
	installedSkill: InstalledSkillView;
	renderHash: string | null;
	createdAt: string;
}

export interface ActiveChatSkill {
	installedSkillId: string;
	templateId: string;
	versionId: string;
	title: string;
	scope: SkillActivationScope;
	riskLevel: SkillTemplate["riskLevel"];
	requiredTools: string[];
	bindingId?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) {
		throw new Error("Failed to load skills");
	}
	return response.json() as Promise<T>;
}

async function getMutationError(response: Response, fallback: string) {
	const payload = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	return new Error(payload?.error ?? fallback);
}

export function activeSkillFromInstalled(
	installedSkill: InstalledSkillView,
	scope: SkillActivationScope,
	bindingId?: string
): ActiveChatSkill {
	return {
		installedSkillId: installedSkill.id,
		templateId: installedSkill.templateId,
		versionId: installedSkill.versionId,
		title: installedSkill.alias ?? installedSkill.template.title,
		scope,
		riskLevel: installedSkill.template.riskLevel,
		requiredTools: installedSkill.template.requiredTools,
		bindingId,
	};
}

export function useSkillTemplates() {
	return useQuery({
		queryKey: ["skills", "templates"],
		queryFn: async () => {
			const data = await fetchJson<{ templates: SkillTemplate[] }>(
				"/api/skills/templates"
			);
			return data.templates;
		},
		staleTime: 5 * 60 * 1000,
	});
}

export function useInstalledSkills() {
	return useQuery({
		queryKey: ["skills", "installed"],
		queryFn: async () => {
			const data = await fetchJson<{
				installedSkills: InstalledSkillView[];
			}>("/api/skills/installed");
			return data.installedSkills;
		},
		staleTime: 30 * 1000,
	});
}

export function useSkillCollections() {
	return useQuery({
		queryKey: ["skills", "collections"],
		queryFn: async () => {
			const data = await fetchJson<{
				collections: SkillCollectionView[];
			}>("/api/skills/collections");
			return data.collections;
		},
		staleTime: 30 * 1000,
	});
}

export function useConversationSkills(conversationId: string | null) {
	return useQuery({
		queryKey: ["conversation-skills", conversationId],
		enabled: Boolean(conversationId),
		queryFn: async () => {
			const data = await fetchJson<{
				bindings: ConversationSkillBindingView[];
			}>(`/api/conversations/${conversationId}/skills`);
			return data.bindings;
		},
		staleTime: 10 * 1000,
	});
}

export function useSkillActions(conversationId: string | null) {
	const queryClient = useQueryClient();

	async function installSkill(templateId: string, versionId?: string) {
		const response = await fetch("/api/skills/installed", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...createIdempotencyHeaders("skills-install"),
			},
			body: JSON.stringify({ templateId, versionId }),
		});
		if (!response.ok) {
			throw await getMutationError(response, "Failed to install skill");
		}
		const data = (await response.json()) as {
			installedSkill: InstalledSkillView;
		};
		await queryClient.invalidateQueries({
			queryKey: ["skills", "installed"],
		});
		return data.installedSkill;
	}

	async function createSkill(input: CreateSkillTemplateInput) {
		const response = await fetch("/api/skills/templates", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...createIdempotencyHeaders("skills-create"),
			},
			body: JSON.stringify(input),
		});
		if (!response.ok) {
			throw await getMutationError(response, "Failed to create skill");
		}
		const data = (await response.json()) as { template: SkillTemplate };
		await queryClient.invalidateQueries({
			queryKey: ["skills", "templates"],
		});
		return data.template;
	}

	async function updateSkill(
		templateId: string,
		input: CreateSkillTemplateInput
	) {
		const response = await fetch(`/api/skills/templates/${templateId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...createIdempotencyHeaders("skills-update"),
			},
			body: JSON.stringify(input),
		});
		if (!response.ok) {
			throw await getMutationError(response, "Failed to update skill");
		}
		const data = (await response.json()) as { template: SkillTemplate };
		await queryClient.invalidateQueries({
			queryKey: ["skills", "templates"],
		});
		return data.template;
	}

	async function updateInstalledSkill(
		installedSkillId: string,
		input: {
			alias?: string | null;
			pinned?: boolean;
			enabled?: boolean;
			defaultScope?: SkillActivationScope | null;
			settings?: Record<string, unknown> | null;
		}
	) {
		const response = await fetch(
			`/api/skills/installed/${installedSkillId}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					...createIdempotencyHeaders("skills-install-update"),
				},
				body: JSON.stringify(input),
			}
		);
		if (!response.ok) {
			throw await getMutationError(response, "Failed to update skill");
		}
		const data = (await response.json()) as {
			installedSkill: InstalledSkillView;
		};
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["skills", "installed"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["skills", "collections"],
			}),
		]);
		return data.installedSkill;
	}

	async function deleteInstalledSkill(installedSkillId: string) {
		const response = await fetch(
			`/api/skills/installed/${installedSkillId}`,
			{
				method: "DELETE",
				headers: createIdempotencyHeaders("skills-install-delete"),
			}
		);
		if (!response.ok) {
			throw await getMutationError(response, "Failed to delete skill");
		}
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["skills", "installed"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["skills", "collections"],
			}),
			conversationId
				? queryClient.invalidateQueries({
						queryKey: ["conversation-skills", conversationId],
					})
				: Promise.resolve(),
		]);
	}

	async function upgradeInstalledSkill(installedSkillId: string) {
		const response = await fetch(
			`/api/skills/installed/${installedSkillId}/upgrade`,
			{
				method: "POST",
				headers: createIdempotencyHeaders("skills-install-upgrade"),
			}
		);
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to update skill version"
			);
		}
		const data = (await response.json()) as {
			installedSkill: InstalledSkillView;
		};
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["skills", "installed"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["skills", "collections"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["skills", "templates"],
			}),
			conversationId
				? queryClient.invalidateQueries({
						queryKey: ["conversation-skills", conversationId],
					})
				: Promise.resolve(),
		]);
		return data.installedSkill;
	}

	async function createCollection(name: string, description?: string | null) {
		const response = await fetch("/api/skills/collections", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...createIdempotencyHeaders("skills-collection-create"),
			},
			body: JSON.stringify({ name, description }),
		});
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to create collection"
			);
		}
		await queryClient.invalidateQueries({
			queryKey: ["skills", "collections"],
		});
	}

	async function addSkillToCollection(
		collectionId: string,
		installedSkillId: string
	) {
		const response = await fetch(
			`/api/skills/collections/${collectionId}/items`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...createIdempotencyHeaders("skills-collection-add"),
				},
				body: JSON.stringify({ installedSkillId }),
			}
		);
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to add skill to collection"
			);
		}
		await queryClient.invalidateQueries({
			queryKey: ["skills", "collections"],
		});
	}

	async function removeSkillFromCollection(
		collectionId: string,
		installedSkillId: string
	) {
		const response = await fetch(
			`/api/skills/collections/${collectionId}/items`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...createIdempotencyHeaders("skills-collection-remove"),
				},
				body: JSON.stringify({ installedSkillId }),
			}
		);
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to remove skill from collection"
			);
		}
		await queryClient.invalidateQueries({
			queryKey: ["skills", "collections"],
		});
	}

	async function deleteCollection(collectionId: string) {
		const response = await fetch(
			`/api/skills/collections/${collectionId}`,
			{
				method: "DELETE",
				headers: createIdempotencyHeaders("skills-collection-delete"),
			}
		);
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to delete collection"
			);
		}
		await queryClient.invalidateQueries({
			queryKey: ["skills", "collections"],
		});
	}

	async function bindConversationSkill(installedSkillId: string) {
		if (!conversationId) return null;
		const response = await fetch(
			`/api/conversations/${conversationId}/skills`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...createIdempotencyHeaders("conversation-skill-bind"),
				},
				body: JSON.stringify({ installedSkillId }),
			}
		);
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to add skill to chat"
			);
		}
		const data = (await response.json()) as {
			binding: ConversationSkillBindingView;
		};
		await queryClient.invalidateQueries({
			queryKey: ["conversation-skills", conversationId],
		});
		return data.binding;
	}

	async function unbindConversationSkill(bindingId: string) {
		if (!conversationId) return;
		const response = await fetch(
			`/api/conversations/${conversationId}/skills`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...createIdempotencyHeaders("conversation-skill-unbind"),
				},
				body: JSON.stringify({ bindingId }),
			}
		);
		if (!response.ok) {
			throw await getMutationError(
				response,
				"Failed to remove skill from chat"
			);
		}
		await queryClient.invalidateQueries({
			queryKey: ["conversation-skills", conversationId],
		});
	}

	return {
		createSkill,
		updateSkill,
		installSkill,
		updateInstalledSkill,
		deleteInstalledSkill,
		upgradeInstalledSkill,
		createCollection,
		addSkillToCollection,
		removeSkillFromCollection,
		deleteCollection,
		bindConversationSkill,
		unbindConversationSkill,
	};
}
