import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Check admin authentication
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get counts
    const [total, today, thisWeek, thisMonth] = await Promise.all([
      prisma.waitlistEntry.count(),
      prisma.waitlistEntry.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.waitlistEntry.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.waitlistEntry.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    // Get daily signups for the last 30 days for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEntries = await prisma.waitlistEntry.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};

    // Initialize all 30 days with 0
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      dailyCounts[dateKey] = 0;
    }

    // Count entries per day
    recentEntries.forEach((entry) => {
      const dateKey = new Date(entry.createdAt).toISOString().split("T")[0];
      if (dailyCounts[dateKey] !== undefined) {
        dailyCounts[dateKey]++;
      }
    });

    // Convert to chart data format
    const chartData = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      signups: count,
    }));

    return NextResponse.json({
      stats: {
        total,
        today,
        thisWeek,
        thisMonth,
      },
      chartData,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
