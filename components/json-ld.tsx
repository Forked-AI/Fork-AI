import { absoluteSiteUrl, SITE_URL } from '@/lib/site-config'

interface JsonLdProps {
	data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, '\\u003c'),
			}}
		/>
	)
}

export const homepageSchema = {
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'Organization',
			'@id': `${SITE_URL}/#organization`,
			name: 'ForkAI',
			alternateName: ['Fork AI', 'forkai.tech'],
			url: absoluteSiteUrl('/'),
			logo: {
				'@type': 'ImageObject',
				'@id': `${SITE_URL}/#logo`,
				url: absoluteSiteUrl('/icon.svg'),
				contentUrl: absoluteSiteUrl('/icon.svg'),
			},
		},
		{
			'@type': 'WebSite',
			'@id': `${SITE_URL}/#website`,
			name: 'ForkAI',
			alternateName: ['Fork AI', 'forkai.tech'],
			url: absoluteSiteUrl('/'),
			publisher: { '@id': `${SITE_URL}/#organization` },
			inLanguage: 'en',
		},
		{
			'@type': 'WebApplication',
			'@id': `${SITE_URL}/#app`,
			name: 'ForkAI',
			alternateName: 'Fork AI',
			url: absoluteSiteUrl('/'),
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Any web browser',
			browserRequirements: 'Requires JavaScript and a modern web browser',
			description:
				'A multi-AI chat workspace with branching conversations, seamless model switching between ChatGPT, Claude, and Gemini, and selective sharing.',
			isAccessibleForFree: true,
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'USD',
				url: absoluteSiteUrl('/#pricing'),
			},
			featureList: [
				'Branching conversations',
				'Multi-AI model support',
				'ChatGPT, Claude, and Gemini model comparison',
				'Selective conversation sharing',
				'Conversation summaries',
				'Conversation export',
			],
			publisher: { '@id': `${SITE_URL}/#organization` },
		},
	],
}
