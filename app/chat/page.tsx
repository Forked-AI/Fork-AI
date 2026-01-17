import { ChatLayout } from "@/components/chat/chat-layout";
import { auth } from "@/lib/auth";
import { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Chat | Fork.AI",
  description: "AI conversations with branching paths. Fork, explore, and discover with multiple AI models.",
};

export default async function ChatPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
//   if (!session) {
//     redirect("/login");
//   }

  return <ChatLayout />;
}
