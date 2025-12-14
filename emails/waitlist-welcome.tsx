import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from '@react-email/components'

interface WaitlistWelcomeEmailProps {
	email: string
}

export default function WaitlistWelcomeEmail({
	email,
}: WaitlistWelcomeEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>You're on the Fork.AI early access list! 🎉</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={logoSection}>
						<Heading style={logo}>Fork.AI</Heading>
					</Section>

					<Heading style={heading}>Welcome to the Future of AI! 🚀</Heading>

					<Text style={paragraph}>Hey there,</Text>

					<Text style={paragraph}>
						Thank you for joining the <strong>Fork.AI</strong> early access
						waitlist! We're thrilled to have you on board.
					</Text>

					<Text style={paragraph}>
						You've secured your spot with:{' '}
						<Link href={`mailto:${email}`} style={link}>
							{email}
						</Link>
					</Text>

					<Section style={highlightBox}>
						<Text style={highlightText}>
							<strong>What happens next?</strong>
						</Text>
						<Text style={highlightText}>
							• We'll notify you as soon as early access opens
							<br />
							• You'll get exclusive first access to new features
							<br />• Early supporters get special perks!
						</Text>
					</Section>

					<Text style={paragraph}>
						Stay tuned for updates. We're working hard to bring you something
						amazing.
					</Text>

					<Text style={signature}>
						Best,
						<br />
						The Fork.AI Team
					</Text>

					<Hr style={hr} />

					<Text style={footer}>
						You received this email because you signed up for Fork.AI early
						access. If this wasn't you, you can safely ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	)
}

// Styles
const main = {
	backgroundColor: '#0a0a0a',
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
}

const container = {
	margin: '0 auto',
	padding: '40px 20px',
	maxWidth: '560px',
}

const logoSection = {
	textAlign: 'center' as const,
	marginBottom: '32px',
}

const logo = {
	color: '#ffffff',
	fontSize: '28px',
	fontWeight: 'bold' as const,
	margin: '0',
	background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
	WebkitBackgroundClip: 'text',
	WebkitTextFillColor: 'transparent',
	backgroundClip: 'text',
}

const heading = {
	color: '#ffffff',
	fontSize: '24px',
	fontWeight: 'bold' as const,
	textAlign: 'center' as const,
	margin: '0 0 24px',
}

const paragraph = {
	color: '#d1d5db',
	fontSize: '16px',
	lineHeight: '26px',
	margin: '0 0 16px',
}

const link = {
	color: '#818cf8',
	textDecoration: 'underline',
}

const highlightBox = {
	backgroundColor: '#1f2937',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
	borderLeft: '4px solid #818cf8',
}

const highlightText = {
	color: '#e5e7eb',
	fontSize: '15px',
	lineHeight: '24px',
	margin: '0 0 8px',
}

const signature = {
	color: '#d1d5db',
	fontSize: '16px',
	lineHeight: '26px',
	margin: '32px 0 0',
}

const hr = {
	borderColor: '#374151',
	margin: '32px 0',
}

const footer = {
	color: '#6b7280',
	fontSize: '12px',
	lineHeight: '20px',
	textAlign: 'center' as const,
}
