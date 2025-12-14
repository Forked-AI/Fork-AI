'use client'

import type React from 'react'

import { AuroraBackground } from '@/components/ui/aurora-background'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		// Simulate login process
		await new Promise((resolve) => setTimeout(resolve, 1000))
		setIsLoading(false)
		console.log('[v0] Login attempt:', { email, password })
	}

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1,
				delayChildren: 0.2,
			},
		},
	}

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				type: 'spring' as const,
				stiffness: 100,
				damping: 10,
			},
		},
	}

	return (
		<AuroraBackground className="min-h-screen w-full">
			<div className="min-h-screen w-full relative flex flex-col pt-20">
				<div className="flex-1 flex items-center justify-center p-4">
					<motion.div
						variants={containerVariants}
						initial="hidden"
						animate="visible"
						className="w-full max-w-md z-10"
					>
						{/* Header */}
						<motion.div variants={itemVariants} className="text-center mb-8">
							<h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
								Welcome back
							</h1>
							<p className="text-muted-foreground text-lg">
								Sign in to your account to continue
							</p>
						</motion.div>

						{/* Login Form */}
						<motion.div
							variants={itemVariants}
							className="glass rounded-2xl p-8 shadow-2xl border-white/10 backdrop-blur-xl"
						>
							<form onSubmit={handleSubmit} className="space-y-6">
								<motion.div variants={itemVariants} className="space-y-2">
									<Label htmlFor="email" className="text-white">
										Email
									</Label>
									<Input
										id="email"
										type="email"
										placeholder="Enter your email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-white/20 focus:ring-white/10 transition-all duration-300 hover:bg-white/10"
										required
									/>
								</motion.div>

								<motion.div variants={itemVariants} className="space-y-2">
									<Label htmlFor="password" className="text-white">
										Password
									</Label>
									<Input
										id="password"
										type="password"
										placeholder="Enter your password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-white/20 focus:ring-white/10 transition-all duration-300 hover:bg-white/10"
										required
									/>
								</motion.div>

								<motion.div
									variants={itemVariants}
									className="flex items-center justify-between"
								>
									<label className="flex items-center space-x-2 text-sm cursor-pointer group">
										<input
											type="checkbox"
											className="rounded border-white/20 bg-white/5 text-white focus:ring-white/20 transition-colors group-hover:border-white/40"
										/>
										<span className="text-muted-foreground group-hover:text-white transition-colors">
											Remember me
										</span>
									</label>
									<Link
										href="#"
										className="text-sm text-white/70 hover:text-white transition-colors hover:underline"
									>
										Forgot password?
									</Link>
								</motion.div>

								<motion.div
									variants={itemVariants}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<Button
										type="submit"
										disabled={isLoading}
										className="w-full bg-white text-black hover:bg-white/90 font-medium py-3 rounded-xl transition-all shadow-lg shadow-white/10 hover:shadow-white/20"
									>
										{isLoading ? 'Signing in...' : 'Sign in'}
									</Button>
								</motion.div>
							</form>

							<motion.div variants={itemVariants} className="mt-6 text-center">
								<p className="text-muted-foreground">
									Don't have an account?{' '}
									<Link
										href="/signup"
										className="text-white hover:underline font-medium transition-colors"
									>
										Sign up
									</Link>
								</p>
							</motion.div>
						</motion.div>

						{/* Social Login */}
						<motion.div variants={itemVariants} className="mt-6">
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-white/10" />
								</div>
								<div className="relative flex justify-center text-sm">
									<span className="px-2 bg-transparent text-muted-foreground backdrop-blur-sm">
										Or continue with
									</span>
								</div>
							</div>

							<div className="mt-6 grid grid-cols-2 gap-3">
								<motion.button
									whileHover={{
										scale: 1.02,
										backgroundColor: 'rgba(255, 255, 255, 1)',
										color: '#000',
									}}
									whileTap={{ scale: 0.98 }}
									className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-200 group"
								>
									<svg
										className="w-5 h-5 mr-2 text-white group-hover:text-black transition-colors duration-200"
										viewBox="0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										/>
										<path
											fill="currentColor"
											d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										/>
										<path
											fill="currentColor"
											d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										/>
										<path
											fill="currentColor"
											d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										/>
									</svg>
									Google
								</motion.button>
								<motion.button
									whileHover={{
										scale: 1.02,
										backgroundColor: 'rgba(255, 255, 255, 1)',
										color: '#000',
									}}
									whileTap={{ scale: 0.98 }}
									className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-200 group"
								>
									<svg
										className="w-5 h-5 mr-2 text-white group-hover:text-black transition-colors duration-200"
										fill="currentColor"
										viewBox="0 0 24 24"
									>
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
									</svg>
									GitHub
								</motion.button>
							</div>
						</motion.div>
					</motion.div>
				</div>
			</div>
		</AuroraBackground>
	)
}
