import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateCollectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const collectionId = params.id;
    const body = await request.json();

    const result = updateCollectionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const collection = await prisma.collection.update({
      where: { id: collectionId },
      data: result.data,
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const collectionId = params.id;

    // Check ownership
    const existing = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Prevent deletion of default collection
    if (existing.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete default collection" },
        { status: 400 }
      );
    }

    // Move conversations to uncategorized (null collectionId)
    await prisma.conversation.updateMany({
      where: { collectionId },
      data: { collectionId: null },
    });

    // Delete collection
    await prisma.collection.delete({
      where: { id: collectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}
