import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt =
	'ForkAI branching conversation workflow with one prompt splitting into AI model responses and a shareable selected branch'
export const size = {
	width: 1200,
	height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
	return new ImageResponse(
		<div
			style={{
				position: 'relative',
				display: 'flex',
				width: '100%',
				height: '100%',
				overflow: 'hidden',
				backgroundColor: '#06090f',
				backgroundImage:
					'radial-gradient(circle at 76% 24%, rgba(125, 211, 252, 0.2), transparent 30%), radial-gradient(circle at 18% 86%, rgba(148, 163, 184, 0.14), transparent 34%)',
				color: '#f8fafc',
				fontFamily: 'sans-serif',
			}}
		>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					backgroundImage:
						'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
					backgroundSize: '40px 40px',
					maskImage:
						'linear-gradient(to right, rgba(0,0,0,0.3), rgba(0,0,0,0.85))',
				}}
			/>

			<div
				style={{
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					width: '55%',
					padding: '64px 38px 58px 68px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
					<svg width="40" height="40" viewBox="0 0 40 40" fill="none">
						<path
							d="M11 7v19c0 4 3 7 7 7h3"
							stroke="#f8fafc"
							strokeWidth="3"
							strokeLinecap="round"
						/>
						<path
							d="M12 22h9c5 0 9-4 9-9V9"
							stroke="#f8fafc"
							strokeWidth="3"
							strokeLinecap="round"
						/>
						<circle
							cx="11"
							cy="6"
							r="4"
							fill="#06090f"
							stroke="#f8fafc"
							strokeWidth="2.5"
						/>
						<circle
							cx="30"
							cy="8"
							r="4"
							fill="#06090f"
							stroke="#f8fafc"
							strokeWidth="2.5"
						/>
						<circle
							cx="24"
							cy="33"
							r="4"
							fill="#06090f"
							stroke="#f8fafc"
							strokeWidth="2.5"
						/>
					</svg>
					<div
						style={{
							display: 'flex',
							fontSize: 36,
							fontWeight: 750,
							letterSpacing: '-1.2px',
						}}
					>
						ForkAI
					</div>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<div
						style={{
							display: 'flex',
							fontSize: 70,
							fontWeight: 780,
							letterSpacing: '-3.4px',
							lineHeight: 1.02,
						}}
					>
						One prompt.
					</div>
					<div
						style={{
							display: 'flex',
							fontSize: 70,
							fontWeight: 780,
							letterSpacing: '-3.4px',
							lineHeight: 1.02,
							color: '#bae6fd',
						}}
					>
						More than one path.
					</div>
					<div
						style={{
							display: 'flex',
							maxWidth: 560,
							marginTop: 25,
							fontSize: 27,
							lineHeight: 1.35,
							color: 'rgba(226, 232, 240, 0.76)',
						}}
					>
						Branch, compare and switch AI models without losing context.
					</div>
				</div>

				<div style={{ display: 'flex', gap: '12px' }}>
					{['BRANCH', 'COMPARE', 'SHARE'].map((label) => (
						<div
							key={label}
							style={{
								display: 'flex',
								padding: '9px 14px',
								border: '1px solid rgba(186, 230, 253, 0.22)',
								borderRadius: 999,
								background: 'rgba(186, 230, 253, 0.07)',
								fontSize: 15,
								fontWeight: 700,
								letterSpacing: '1.6px',
								color: 'rgba(224, 242, 254, 0.82)',
							}}
						>
							{label}
						</div>
					))}
				</div>
			</div>

			<div
				style={{
					position: 'relative',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: '45%',
					padding: '54px 62px 54px 20px',
				}}
			>
				<div
					style={{
						display: 'flex',
						width: 460,
						height: 500,
						alignItems: 'center',
						justifyContent: 'center',
						border: '1px solid rgba(255, 255, 255, 0.12)',
						borderRadius: 36,
						background: 'rgba(15, 23, 42, 0.72)',
						boxShadow: '0 28px 80px rgba(0, 0, 0, 0.36)',
					}}
				>
					<div
						style={{
							position: 'relative',
							display: 'flex',
							width: 410,
							height: 450,
						}}
					>
						<svg
							width="410"
							height="450"
							viewBox="0 0 410 450"
							fill="none"
							style={{ position: 'absolute', inset: 0 }}
						>
							<defs>
								<linearGradient
									id="branch-line"
									x1="205"
									y1="100"
									x2="205"
									y2="353"
								>
									<stop stopColor="#bae6fd" stopOpacity="0.7" />
									<stop offset="1" stopColor="#6ee7b7" stopOpacity="0.55" />
								</linearGradient>
							</defs>
							<path
								d="M205 91V130M205 130C205 150 112 151 112 179M205 130C205 150 298 151 298 179"
								stroke="url(#branch-line)"
								strokeWidth="3"
								strokeLinecap="round"
							/>
							<path
								d="M112 267C112 295 205 290 205 322M298 267C298 295 205 290 205 322"
								stroke="url(#branch-line)"
								strokeWidth="3"
								strokeLinecap="round"
							/>
						</svg>

						<div
							style={{
								position: 'absolute',
								left: 93,
								top: 30,
								display: 'flex',
								alignItems: 'center',
								width: 224,
								height: 62,
								padding: '0 18px',
								border: '1px solid rgba(186, 230, 253, 0.38)',
								borderRadius: 18,
								background: '#111827',
							}}
						>
							<div
								style={{
									display: 'flex',
									width: 20,
									height: 20,
									marginRight: 14,
									borderRadius: 999,
									background: '#bae6fd',
								}}
							/>
							<div style={{ display: 'flex', flexDirection: 'column' }}>
								<div
									style={{
										display: 'flex',
										fontSize: 12,
										fontWeight: 700,
										letterSpacing: '1.5px',
										color: '#94a3b8',
									}}
								>
									ONE PROMPT
								</div>
								<div
									style={{
										display: 'flex',
										fontSize: 16,
										fontWeight: 650,
										color: '#f8fafc',
									}}
								>
									Plan a product launch
								</div>
							</div>
						</div>

						<div
							style={{
								position: 'absolute',
								left: 188,
								top: 113,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 34,
								height: 34,
								border: '2px solid #bae6fd',
								borderRadius: 999,
								background: '#0f172a',
								fontSize: 25,
								lineHeight: 1,
								color: '#bae6fd',
							}}
						>
							+
						</div>

						{[
							{
								left: 32,
								label: 'RESEARCH',
								accent: '#a5f3fc',
								border: 'rgba(103, 232, 249, 0.34)',
							},
							{
								left: 218,
								label: 'COMPARE',
								accent: '#fde68a',
								border: 'rgba(251, 191, 36, 0.34)',
							},
						].map((card) => (
							<div
								key={card.label}
								style={{
									position: 'absolute',
									left: card.left,
									top: 179,
									display: 'flex',
									flexDirection: 'column',
									width: 160,
									height: 88,
									padding: '20px 22px',
									border: `1px solid ${card.border}`,
									borderRadius: 18,
									background: '#111827',
								}}
							>
								<div
									style={{
										display: 'flex',
										fontSize: 14,
										fontWeight: 700,
										letterSpacing: '1px',
										color: card.accent,
									}}
								>
									{card.label}
								</div>
								<div
									style={{
										display: 'flex',
										width: 109,
										height: 8,
										marginTop: 14,
										borderRadius: 4,
										background: 'rgba(203, 213, 225, 0.2)',
									}}
								/>
							</div>
						))}

						<div
							style={{
								position: 'absolute',
								left: 68,
								top: 322,
								display: 'flex',
								alignItems: 'center',
								width: 274,
								height: 86,
								padding: '0 22px',
								border: '1px solid rgba(110, 231, 183, 0.48)',
								borderRadius: 20,
								background: 'rgba(6, 78, 59, 0.4)',
							}}
						>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: 28,
									height: 28,
									marginRight: 18,
									borderRadius: 999,
									background: 'rgba(110, 231, 183, 0.18)',
									fontSize: 18,
									color: '#a7f3d0',
								}}
							>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path
										d="M3 8.2 6.3 11.5 13 4.7"
										stroke="#a7f3d0"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</div>
							<div style={{ display: 'flex', flexDirection: 'column' }}>
								<div
									style={{
										display: 'flex',
										fontSize: 13,
										fontWeight: 700,
										letterSpacing: '1px',
										color: '#a7f3d0',
									}}
								>
									SELECTED BRANCH
								</div>
								<div
									style={{
										display: 'flex',
										fontSize: 16,
										fontWeight: 650,
										color: '#ecfdf5',
									}}
								>
									Ready to share
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>,
		{
			...size,
		}
	)
}
