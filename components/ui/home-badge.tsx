import { Badge } from '@/components/ui/badge'
import { GitBranch } from 'lucide-react'

export default function HomeBadge() {
	return (
		<Badge
			variant="secondary"
			/* Enhanced with glass effect, shimmer animation, and silver dot */
			className="glass glass-hover border-white/20 px-4 py-1.5 rounded-full shimmer group"
		>
			<GitBranch className="w-3 h-3 mr-2 text-[#cbd5e1]" />
			Multi-AI Platform
		</Badge>
	)
}
