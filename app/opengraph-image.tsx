import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Fork AI - Branch, Compare & Switch AI Models in One Chat'
export const size = {
	width: 1200,
	height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
	return new ImageResponse(
		<div
			style={{
				background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '80px',
				fontFamily: 'sans-serif',
			}}
		>
			{/* Logo/Brand Area */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					marginBottom: '40px',
				}}
			>
				<div
					style={{
						fontSize: '120px',
						fontWeight: 'bold',
						color: 'white',
						textShadow: '0 4px 20px rgba(0,0,0,0.3)',
					}}
				>
					Fork AI
				</div>
			</div>

			{/* Tagline */}
			<div
				style={{
					fontSize: '48px',
					color: 'rgba(255,255,255,0.95)',
					textAlign: 'center',
					maxWidth: '900px',
					lineHeight: '1.3',
					marginBottom: '30px',
				}}
			>
				Branch, Compare & Switch AI Models in One Chat
			</div>

			{/* Description */}
			<div
				style={{
					fontSize: '32px',
					color: 'rgba(255,255,255,0.85)',
					textAlign: 'center',
					maxWidth: '800px',
					lineHeight: '1.4',
				}}
			>
				ChatGPT • Claude • Gemini — All in one workspace
			</div>
		</div>,
		{
			...size,
		}
	)
}
