'use client'

import { cn } from '@/lib/utils'
import { FEEDBACK_REASONS } from '@/lib/feedback/reasons'
import { X } from 'lucide-react'
import { useState } from 'react'

interface FeedbackModalProps {
	isOpen: boolean
	onClose: () => void
	onSubmit: (reasons: string[], comment: string, correction: string) => void
}

export function FeedbackModal({
	isOpen,
	onClose,
	onSubmit,
}: FeedbackModalProps) {
	const [selectedReasons, setSelectedReasons] = useState<string[]>([])
	const [comment, setComment] = useState('')
	const [correction, setCorrection] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	if (!isOpen) return null

	const handleReasonToggle = (reason: string) => {
		setSelectedReasons((prev) =>
			prev.includes(reason)
				? prev.filter((r) => r !== reason)
				: [...prev, reason]
		)
	}

	const handleSubmit = async () => {
		if (selectedReasons.length === 0 && !comment.trim() && !correction.trim()) {
			return
		}

		setIsSubmitting(true)
		try {
			await onSubmit(selectedReasons, comment, correction)
			setSelectedReasons([])
			setComment('')
			setCorrection('')
			onClose()
		} catch (err) {
			console.error('Failed to submit feedback:', err)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleClose = () => {
		setSelectedReasons([])
		setComment('')
		setCorrection('')
		onClose()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
			<div className="w-full max-w-lg bg-[#0f1419] border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-border/50">
					<h3 className="text-lg font-semibold text-foreground">
						Provide Feedback
					</h3>
					<button
						onClick={handleClose}
						className="p-1 rounded-lg hover:bg-background/50 transition-colors"
					>
						<X className="w-5 h-5 text-muted-foreground" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
					<div>
						<p className="text-sm text-muted-foreground mb-3">
							What went wrong with this response?
						</p>
						<div className="flex flex-wrap gap-2">
							{FEEDBACK_REASONS.map((reason) => (
								<button
									key={reason.id}
									onClick={() => handleReasonToggle(reason.id)}
									className={cn(
										'px-3 py-1.5 text-xs rounded-lg border transition-colors',
										selectedReasons.includes(reason.id)
											? 'bg-primary/10 border-primary text-primary'
											: 'bg-background/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
									)}
								>
									{reason.label}
								</button>
							))}
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-foreground mb-2">
							Correct answer (optional)
						</label>
						<textarea
							value={correction}
							onChange={(e) => setCorrection(e.target.value)}
							placeholder="Write the answer you expected or the correction ForkAI should learn from."
							className="w-full h-24 px-3 py-2 bg-background/30 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-foreground mb-2">
							Additional comments (optional)
						</label>
						<textarea
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							placeholder="Tell us more about what went wrong..."
							className="w-full h-32 px-3 py-2 bg-background/30 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
						/>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 p-4 border-t border-border/50">
					<button
						onClick={handleClose}
						className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						disabled={
							isSubmitting ||
							(selectedReasons.length === 0 &&
								!comment.trim() &&
								!correction.trim())
						}
						className={cn(
							'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
							isSubmitting ||
								(selectedReasons.length === 0 &&
									!comment.trim() &&
									!correction.trim())
								? 'bg-primary/20 text-primary/50 cursor-not-allowed'
								: 'bg-primary/10 text-primary hover:bg-primary/20'
						)}
					>
						{isSubmitting ? 'Submitting...' : 'Submit Feedback'}
					</button>
				</div>
			</div>
		</div>
	)
}
