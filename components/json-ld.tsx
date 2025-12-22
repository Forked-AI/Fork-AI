
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
	url: 'https://fork-ai.com',
	logo: 'https://fork-ai.com/icon.svg',
	description:
		'Fork AI is a revolutionary multi-AI platform that lets you explore different conversation paths, compare AI models side-by-side, and unlock the full potential of artificial intelligence.',
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
	aggregateRating: {
		'@type': 'AggregateRating',
		ratingValue: '4.8',
		ratingCount: '150',
	},
	description:
		'Multi-AI platform with branching conversations. Explore different conversation paths, compare AI models side-by-side, and unlock the full potential of artificial intelligence.',
	featureList: [
		'Branching conversations',
		'Multi-AI model support',
		'Side-by-side model comparison',
		'Privacy-first sharing',
		'Conversation forking',
		'Real-time AI switching',
	],
}
