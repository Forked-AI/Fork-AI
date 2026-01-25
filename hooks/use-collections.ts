import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Collection {
  id: string;
  name: string;
  color: string;
  userId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    conversations: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  collectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const res = await fetch("/api/collections", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please log in to access collections");
        }
        throw new Error("Failed to fetch collections");
      }
      const data = await res.json();
      return data.collections as Collection[];
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create collection");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; color?: string };
    }) => {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update collection");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/collections/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete collection");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useMoveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      collectionId,
    }: {
      conversationId: string;
      collectionId: string | null;
    }) => {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ collectionId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to move conversation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
