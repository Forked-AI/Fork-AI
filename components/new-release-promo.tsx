'use client'

import { GitBranch } from 'lucide-react'

export function NewReleasePromo() {
	return (
		<section className="mt-12 w-full">
			<div className="mx-auto max-w-4xl rounded-[40px] border border-white/10 p-2 shadow-xl backdrop-blur-sm bg-white/5">
				<div className="relative mx-auto h-[400px] max-w-4xl overflow-hidden rounded-[38px] border border-white/10 glass p-2 shadow-2xl">
					<div
						className="absolute inset-0 z-0"
						style={{
							background:
								'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(226, 232, 240, 0.08), transparent 70%)',
						}}
					/>

					{/* Film grain overlay */}
					<div
						className="absolute inset-0 z-0 opacity-[0.02]"
						style={{
							backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
						}}
					/>

					<div className="relative z-10">
						<div className="mt-8 text-center">
							<h2 className="text-4xl font-bold mb-6 text-white">
								Fork your AI, fork everything
							</h2>
							<p className="mb-8 text-lg text-white/90">
								The best AI UX you have ever experienced.
							</p>
							<p className="text-white/60 mb-6">
								Join early users shaping the future of multi-AI workflows.
							</p>
							<GitBranch className="w-16 h-16 mx-auto mb-4 text-white" />
							<div className="flex items-center justify-center">
								<a href="/prelaunch">
									<div className="group glass glass-hover flex h-[64px] cursor-pointer items-center gap-2 rounded-full p-[11px] mt-10 shimmer">
										<div className="bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] flex h-[43px] items-center justify-center rounded-full border border-white/20 shadow-lg">
											<p className="mr-3 ml-2 flex items-center justify-center gap-2 font-medium tracking-tight text-black">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="24"
													height="24"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
													className="lucide lucide-globe animate-spin"
													aria-hidden="true"
												>
													<circle cx="12" cy="12" r="10"></circle>
													<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
													<path d="M2 12h20"></path>
												</svg>
												Get Early Access
											</p>
										</div>
										<div className="flex size-[26px] items-center justify-center rounded-full border-2 border-white/30 transition-all ease-in-out group-hover:ml-2 group-hover:border-white/50 group-hover:rotate-45">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="18"
												height="18"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="lucide lucide-arrow-right transition-all ease-in-out text-white"
												aria-hidden="true"
											>
												<path d="M5 12h14"></path>
												<path d="m12 5 7 7-7 7"></path>
											</svg>
										</div>
									</div>
								</a>
							</div>
						</div>

						<h1
							className="absolute inset-x-0 mt-[120px] text-center text-[80px] font-semibold text-transparent sm:mt-[30px] sm:text-[160px] pointer-events-none"
							style={{
								WebkitTextStroke: '1px rgba(148, 163, 184, 0.3)',
								color: 'transparent',
							}}
							aria-hidden="true"
						>
							Fork AI
						</h1>
						<h1
							className="absolute inset-x-0 mt-[120px] text-center text-[80px] font-semibold sm:mt-[30px] sm:text-[160px] pointer-events-none bg-gradient-to-b from-[#cbd5e1] to-[#64748b] bg-clip-text text-transparent"
							aria-hidden="true"
						>
							Fork AI
						</h1>
					</div>
				</div>
			</div>
		</section>
	)
}
