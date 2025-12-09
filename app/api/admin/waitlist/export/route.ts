import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Check admin authentication
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all entries for export
    const entries = await prisma.waitlistEntry.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Create CSV content
    const csvHeaders = "ID,Email,Signed Up At\n";
    const csvRows = entries
      .map((entry) => {
        const date = new Date(entry.createdAt).toISOString();
        return `${entry.id},${entry.email},${date}`;
      })
      .join("\n");

    const csv = csvHeaders + csvRows;

    // Return as downloadable CSV
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="waitlist-export-${
          new Date().toISOString().split("T")[0]
        }.csv"`,
      },
    });
  } catch (error) {
    console.error("Admin export error:", error);
    return NextResponse.json(
      { error: "Failed to export waitlist" },
      { status: 500 }
    );
  }
}
