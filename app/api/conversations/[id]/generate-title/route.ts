import { auth } from "@/lib/auth";
import { mistralClient } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// POST - Generate a title for a conversation using AI
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const userId = session.user.id;

    // Fetch the conversation with its messages
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 4, // First 2 exchanges (2 user + 2 assistant messages)
          select: {
            role: true,
            content: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Need at least 2 messages to generate a meaningful title
    if (conversation.messages.length < 2) {
      return NextResponse.json(
        { error: "Not enough messages to generate title" },
        { status: 400 }
      );
    }

    // Build prompt for title generation
    const messageContext = conversation.messages
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join("\n\n");

    const titlePrompt = `Based on the following conversation, generate a concise, descriptive title (3-6 words). The title should capture the main topic or purpose of the conversation. Only respond with the title, nothing else.

Conversation:
${messageContext}

Title:`;

    // Use a fast, small model for title generation
    const response = await mistralClient.chat.complete({
      model: "ministral-3b-latest",
      messages: [
        {
          role: "user",
          content: titlePrompt,
        },
      ],
      maxTokens: 20,
      temperature: 0.3,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const generatedTitle =
      (typeof rawContent === 'string' ? rawContent.trim() : rawContent?.[0]?.toString().trim()) ||
      conversation.title;

    // Clean up the title (remove quotes, newlines, etc.)
    const cleanTitle = generatedTitle
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/\n/g, " ") // Replace newlines
      .trim()
      .slice(0, 100); // Max 100 chars

    // Update the conversation title
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: cleanTitle },
    });

    return NextResponse.json({ 
      title: cleanTitle,
      conversationId,
    });
  } catch (error) {
    console.error("Error generating title:", error);
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 }
    );
  }
}
