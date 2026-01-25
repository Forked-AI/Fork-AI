"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCollections, useCreateCollection, useDeleteCollection, useUpdateCollection } from "@/hooks/use-collections";
import { Check, Edit2, Folder, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

const PRESET_COLORS = [
  "#57FCFF",
  "#FF6B9D", 
  "#FFD93D",
  "#9B59B6",
  "#2ECC71",
  "#E67E22",
  "#95A5A6",
  "#E74C3C",
];

interface CollectionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionsModal({ open, onOpenChange }: CollectionsModalProps) {
  const { data: collections, isLoading, error } = useCollections();
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();

  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;

    try {
      await createCollection.mutateAsync({
        name: newCollectionName.trim(),
        color: selectedColor,
      });
      setNewCollectionName("");
      setSelectedColor(PRESET_COLORS[0]);
    } catch (error) {
      console.error("Failed to create collection:", error);
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;

    try {
      await updateCollection.mutateAsync({
        id,
        data: { name: editingName.trim() },
      });
      setEditingId(null);
      setEditingName("");
    } catch (error) {
      console.error("Failed to update collection:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleUpdateColor = async (id: string, color: string) => {
    try {
      await updateCollection.mutateAsync({
        id,
        data: { color },
      });
      setShowColorPicker(null);
    } catch (error) {
      console.error("Failed to update color:", error);
    }
  };

  const handleDelete = async (id: string, isDefault: boolean, name: string) => {
    if (isDefault) {
      return; // Silently ignore, button should be disabled anyway
    }
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await deleteCollection.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete collection:", error);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0d11]/95 backdrop-blur-2xl border border-[#57FCFF]/30 max-w-[95vw] sm:max-w-[85vw] lg:max-w-[1041px] max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[32px] font-bold text-white">
            Folders
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Create new folder section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Folder name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                className="flex-1 h-[42px] bg-white/5 border-white/10 text-white rounded-[11px] px-4"
              />
              <Button
                onClick={handleCreate}
                disabled={!newCollectionName.trim() || createCollection.isPending}
                className="h-[42px] px-6 bg-[#00D5BE] hover:bg-[#00D5BE]/80 text-black font-bold rounded-[11px]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[20px] font-bold text-white">Add new folder</span>
            </div>
          </div>

          <div className="h-px bg-[#5F5F5F]"></div>

          {/* Folders grid */}
          <div>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Folder className="w-16 h-16 text-red-400/30 mb-4" />
                <p className="text-red-400 text-sm">
                  {error instanceof Error && error.message.includes("log in")
                    ? "Please log in to manage folders"
                    : "Failed to load folders"}
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse mb-4"></div>
                <p className="text-gray-400 text-sm">Loading folders...</p>
              </div>
            ) : collections && collections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="group relative bg-white/[0.04] hover:bg-white/[0.06] border border-white/10 rounded-[20px] p-6 transition-all backdrop-blur-[19.8px]"
                  >
                    {editingId === collection.id ? (
                      <div className="flex flex-col items-center space-y-4">
                        <Folder 
                          className="w-[74px] h-[74px] mb-2" 
                          style={{ color: collection.color }}
                        />
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(collection.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className="w-full h-10 bg-white/10 border-white/20 text-white text-center"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(collection.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCancelEdit}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Action buttons - top right */}
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(collection.id, collection.name)}
                            className="h-7 w-7 p-0 hover:bg-white/10 rounded-full"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                          </Button>
                          {!collection.isDefault && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(collection.id, collection.isDefault, collection.name)}
                              className="h-7 w-7 p-0 hover:bg-red-500/20 rounded-full"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                          )}
                        </div>

                        {/* Card content */}
                        <div className="flex flex-col items-center text-center space-y-3">
                          <Folder 
                            className="w-[74px] h-[74px]" 
                            style={{ color: collection.color }}
                          />
                          <div>
                            <h3 className="text-white font-bold text-[16px] mb-1">
                              {collection.name}
                              {collection.isDefault && (
                                <span className="text-xs text-gray-500 ml-2">(default)</span>
                              )}
                            </h3>
                            <p className="text-[#9C9C9C] text-[12px]">
                              {collection._count.conversations} chat{collection._count.conversations !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-[20px] bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Folder className="w-10 h-10 text-gray-500" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">No folders yet</h3>
                <p className="text-gray-400 text-sm max-w-xs">
                  Create your first folder to organize your conversations
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
      <AlertDialogContent className="bg-[#0a0d11]/95 backdrop-blur-2xl border border-[#57FCFF]/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Delete Folder</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Are you sure you want to delete <span className="text-white font-semibold">"{deleteConfirm?.name}"</span>? 
            All conversations in this folder will be moved to Uncategorized.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
