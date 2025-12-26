interface JsonLdProps {
	data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	)
}

// Organization Schema
export const organizationSchema = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: 'Fork AI',
	url: 'https://forkai.tech',
	logo: 'https://forkai.tech/icon.svg',
	description:
		'Fork AI is a free multi-AI chat platform with smart branching, seamless model switching between ChatGPT, Claude, and Gemini, and privacy-first sharing.',
	sameAs: [
		// Add your social media URLs here when ready
		// 'https://twitter.com/forkai',
		// 'https://github.com/forkai',
		// 'https://linkedin.com/company/forkai',
	],
	contactPoint: {
		'@type': 'ContactPoint',
		contactType: 'Customer Support',
		// email: 'support@fork-ai.com',
	},
}

// Software Application Schema
export const softwareApplicationSchema = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: 'Fork AI',
	applicationCategory: 'BusinessApplication',
	operatingSystem: 'Web',
	offers: {
		'@type': 'Offer',
		price: '0',
		priceCurrency: 'USD',
	},
	// NOTE: Aggregate rating removed - add back when you have real reviews
	// Having fake reviews violates Google's structured data guidelines
	description:
		'Free multi-AI chat platform with smart branching. Switch between ChatGPT, Claude, and Gemini without losing context. Branch conversations and organize AI chats effortlessly.',
	featureList: [
		'Branching conversations',
		'Multi-AI model support',
		'Side-by-side model comparison',
		'Privacy-first sharing',
		'Conversation forking',
		'Real-time AI switching',
	],
}

// Product Schema
export const productSchema = {
	'@context': 'https://schema.org',
	'@type': 'Product',
	name: 'Fork AI',
	description:
		'Multi-AI platform for branching conversations with ChatGPT, Claude, and Gemini.',
	brand: {
		'@type': 'Brand',
		name: 'Fork AI',
	},
	offers: {
		'@type': 'Offer',
		price: '0',
		priceCurrency: 'USD',
		availability: 'https://schema.org/InStock',
	},
}
