import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function getExportFilename(extension: "json" | "md") {
	const date = new Date().toISOString().slice(0, 10);
	return `fork-ai-account-export-${date}.${extension}`;
}

function formatMarkdownExport(exportData: Awaited<ReturnType<typeof buildExportData>>) {
	const lines: string[] = [
		"# Fork AI Account Export",
		"",
		`Exported at: ${exportData.exportedAt}`,
		"",
		"## Profile",
		"",
		`- Name: ${exportData.profile.name}`,
		`- Email: ${exportData.profile.email}`,
		`- Email verified: ${exportData.profile.emailVerified ? "yes" : "no"}`,
		`- Created: ${exportData.profile.createdAt}`,
		"",
		"## Conversations",
		"",
	];

	for (const conversation of exportData.conversations) {
		lines.push(`### ${conversation.title}`, "");
		lines.push(`Created: ${conversation.createdAt}`);
		lines.push(`Updated: ${conversation.updatedAt}`, "");

		for (const message of conversation.messages) {
			lines.push(`**${message.role}**`);
			lines.push("");
			lines.push(message.content);
			lines.push("");
		}
	}

	lines.push("## Shares", "");
	for (const share of exportData.shares) {
		lines.push(`### ${share.title}`, "");
		lines.push(`- Active: ${share.isActive ? "yes" : "no"}`);
		lines.push(`- Created: ${share.createdAt}`);
		lines.push(`- Expires: ${share.expiresAt ?? "never"}`);
		lines.push(`- Access count: ${share.accessCount}`);
		lines.push("");
	}

	return lines.join("\n");
}

async function buildExportData(userId: string) {
	const [user, conversations, shares] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				emailVerified: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
		prisma.conversation.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			include: {
				collection: {
					select: { id: true, name: true, color: true },
				},
				messages: {
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						role: true,
						content: true,
						model: true,
						promptTokens: true,
						completionTokens: true,
						isError: true,
						parentMessageId: true,
						createdAt: true,
					},
				},
			},
		}),
		prisma.sharedConversation.findMany({
			where: { createdBy: userId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				conversationId: true,
				shareToken: true,
				selectedMessageIds: true,
				snapshotData: true,
				summaryData: true,
				maskingData: true,
				title: true,
				createdAt: true,
				expiresAt: true,
				isActive: true,
				accessCount: true,
				allowDownload: true,
				showTimestamps: true,
				showModel: true,
			},
		}),
	]);

	if (!user) {
		throw new Error("Authenticated user was not found");
	}

	return {
		exportedAt: new Date().toISOString(),
		profile: {
			...user,
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
		},
		conversations: conversations.map((conversation) => ({
			...conversation,
			createdAt: conversation.createdAt.toISOString(),
			updatedAt: conversation.updatedAt.toISOString(),
			messages: conversation.messages.map((message) => ({
				...message,
				createdAt: message.createdAt.toISOString(),
			})),
		})),
		shares: shares.map((share) => ({
			...share,
			createdAt: share.createdAt.toISOString(),
			expiresAt: share.expiresAt?.toISOString() ?? null,
		})),
	};
}

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const url = new URL(request.url);
		const format = url.searchParams.get("format") === "markdown" ? "md" : "json";
		const exportData = await buildExportData(session.user.id);

		logServerInfo("account/export", "generated", {
			format,
			conversationCount: exportData.conversations.length,
			shareCount: exportData.shares.length,
		});

		if (format === "md") {
			return new Response(formatMarkdownExport(exportData), {
				status: 200,
				headers: {
					"Content-Type": "text/markdown; charset=utf-8",
					"Content-Disposition": `attachment; filename="${getExportFilename("md")}"`,
				},
			});
		}

		return new Response(JSON.stringify(exportData, null, 2), {
			status: 200,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Content-Disposition": `attachment; filename="${getExportFilename("json")}"`,
			},
		});
	} catch (error) {
		logServerError("account/export", "generate_failed", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
