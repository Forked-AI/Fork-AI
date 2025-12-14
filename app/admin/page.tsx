'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import { Calendar, Clock, Loader2, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

interface Stats {
	total: number
	today: number
	thisWeek: number
	thisMonth: number
}

interface ChartDataPoint {
	date: string
	signups: number
}

export default function AdminDashboard() {
	const [stats, setStats] = useState<Stats | null>(null)
	const [chartData, setChartData] = useState<ChartDataPoint[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		fetchStats()
	}, [])

	const fetchStats = async () => {
		try {
			const password = sessionStorage.getItem('adminPassword')
			const response = await fetch('/api/admin/stats', {
				headers: { 'x-admin-password': password || '' },
			})

			if (!response.ok) throw new Error('Failed to fetch stats')

			const data = await response.json()
			setStats(data.stats)
			setChartData(data.chartData)
		} catch (err) {
			setError('Failed to load dashboard data')
		} finally {
			setIsLoading(false)
		}
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="w-8 h-8 animate-spin text-white/60" />
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-red-400">{error}</p>
			</div>
		)
	}

	const statCards = [
		{
			title: 'Total Signups',
			value: stats?.total || 0,
			icon: Users,
			color: 'text-indigo-400',
			bgColor: 'bg-indigo-400/10',
		},
		{
			title: 'Today',
			value: stats?.today || 0,
			icon: Clock,
			color: 'text-green-400',
			bgColor: 'bg-green-400/10',
		},
		{
			title: 'This Week',
			value: stats?.thisWeek || 0,
			icon: Calendar,
			color: 'text-blue-400',
			bgColor: 'bg-blue-400/10',
		},
		{
			title: 'This Month',
			value: stats?.thisMonth || 0,
			icon: TrendingUp,
			color: 'text-purple-400',
			bgColor: 'bg-purple-400/10',
		},
	]

	const chartConfig = {
		signups: {
			label: 'Signups',
			color: 'hsl(var(--chart-1))',
		},
	}

	return (
		<div className="p-8 pb-16">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-white">Dashboard</h1>
				<p className="text-white/60 mt-1">
					Overview of your waitlist performance
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				{statCards.map((card) => (
					<Card
						key={card.title}
						className="bg-[#111] border-white/10 hover:border-white/20 transition-colors"
					>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-white/60">
								{card.title}
							</CardTitle>
							<div className={`p-2 rounded-lg ${card.bgColor}`}>
								<card.icon className={`w-4 h-4 ${card.color}`} />
							</div>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold text-white">{card.value}</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Chart */}
			<Card className="bg-[#111] border-white/10">
				<CardHeader>
					<CardTitle className="text-white">Signups Over Time</CardTitle>
					<p className="text-white/60 text-sm">Last 30 days</p>
				</CardHeader>
				<CardContent>
					<ChartContainer config={chartConfig} className="h-[300px] w-full">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData}>
								<defs>
									<linearGradient
										id="signupGradient"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
										<stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
									</linearGradient>
								</defs>
								<XAxis
									dataKey="date"
									stroke="#ffffff40"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => {
										const date = new Date(value)
										return `${date.getMonth() + 1}/${date.getDate()}`
									}}
								/>
								<YAxis
									stroke="#ffffff40"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									allowDecimals={false}
								/>
								<ChartTooltip
									content={<ChartTooltipContent />}
									cursor={{ stroke: '#ffffff20' }}
								/>
								<Area
									type="monotone"
									dataKey="signups"
									stroke="#818cf8"
									strokeWidth={2}
									fill="url(#signupGradient)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</ChartContainer>
				</CardContent>
			</Card>
		</div>
	)
}
