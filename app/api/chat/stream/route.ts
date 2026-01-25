import { auth } from "@/lib/auth";
import { checkChatRateLimit } from "@/lib/chat-rate-limit";
import { mistralClient } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

// Input validation schema
const sendMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(32000, "Message too long"),
  model: z.string().default("mistral-large-latest"),
  conversationId: z.string().optional().nullable(),
});

// Supported models mapping
const SUPPORTED_MODELS: Record<string, string> = {
  "mistral-large": "mistral-large-latest",
  "mistral-large-latest": "mistral-large-latest",
  "mistral-small": "mistral-small-latest",
  "mistral-small-latest": "mistral-small-latest",
  "codestral": "codestral-latest",
  "codestral-latest": "codestral-latest",
  "ministral-8b": "ministral-8b-latest",
  "ministral-8b-latest": "ministral-8b-latest",
  "ministral-3b": "ministral-3b-latest",
  "ministral-3b-latest": "ministral-3b-latest",
  "pixtral-large": "pixtral-large-latest",
  "pixtral-large-latest": "pixtral-large-latest",
  "open-mistral-nemo": "open-mistral-nemo",
};

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Parse and validate input
    const body = await request.json();
    const parseResult = sendMessageSchema.safeParse(body);

    if (!parseResult.success) {
      console.error('[chat/stream] Validation error:', parseResult.error.flatten());
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { message, model, conversationId } = parseResult.data;

    // 3. Validate model
    const mistralModel = SUPPORTED_MODELS[model];
    if (!mistralModel) {
      return NextResponse.json(
        { error: "Unsupported model", supportedModels: Object.keys(SUPPORTED_MODELS) },
        { status: 400 }
      );
    }

    // 4. Check rate limit
    const rateLimit = await checkChatRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: rateLimit.retryAfterSeconds,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { 
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 3600),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    // 5. Get or create conversation
    let conversation;
    let isNewConversation = false;

    if (conversationId) {
      // Verify ownership
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
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
    } else {
      // Create new conversation with first message as title
      const title = message.slice(0, 100) + (message.length > 100 ? "..." : "");
      conversation = await prisma.conversation.create({
        data: {
          title,
          userId,
        },
        include: {
          messages: true,
        },
      });
      isNewConversation = true;
    }

    // 6. Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        role: "user",
        content: message,
        conversationId: conversation.id,
      },
    });

    // 7. Build message history for Mistral
    const messageHistory = [
      ...conversation.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // 8. Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let streamError: Error | null = null;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Call Mistral streaming API
          const stream = await mistralClient.chat.stream({
            model: mistralModel,
            messages: messageHistory,
          });

          // Send conversation ID first (for new conversations)
          if (isNewConversation) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: "conversation", 
                  conversationId: conversation.id 
                })}\n\n`
              )
            );
          }

          // Send message ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: "messageId", 
                userMessageId: userMessage.id 
              })}\n\n`
            )
          );

          // Stream response chunks
          for await (const event of stream) {
            const content = event.data?.choices[0]?.delta.content;
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "content", content })}\n\n`
                )
              );
            }

            // Capture usage data from the last chunk
            if (event.data?.usage) {
              promptTokens = event.data.usage.promptTokens || 0;
              completionTokens = event.data.usage.completionTokens || 0;
            }
          }

          // Save assistant message to database
          const assistantMessage = await prisma.message.create({
            data: {
              role: "assistant",
              content: fullResponse,
              model: mistralModel,
              promptTokens,
              completionTokens,
              conversationId: conversation.id,
              isError: false,
            },
          });

          // Update conversation timestamp
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });

          // Send completion with metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: "done",
                assistantMessageId: assistantMessage.id,
                usage: { promptTokens, completionTokens }
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          streamError = error as Error;
          console.error("Streaming error:", error);

          // Save partial response with error flag if we have any content
          if (fullResponse.length > 0) {
            await prisma.message.create({
              data: {
                role: "assistant",
                content: fullResponse,
                model: mistralModel,
                conversationId: conversation.id,
                isError: true,
              },
            });
          }

          // Send error to client
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: "error", 
                error: "Stream interrupted. You can retry this message.",
                partialContent: fullResponse.length > 0
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
