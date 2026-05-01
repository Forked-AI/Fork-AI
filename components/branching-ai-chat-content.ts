export interface BranchingAiSubsection {
	id: string;
	title: string;
	paragraphs: string[];
}

export interface BranchingAiHighlightCard {
	title: string;
	description: string;
}

export interface BranchingAiPullQuote {
	quote: string;
	note?: string;
}

export interface BranchingAiAside {
	eyebrow: string;
	title: string;
	body: string;
	bullets?: string[];
}

export type BranchingAiSectionLayout =
	| "prose"
	| "split"
	| "feature-band"
	| "case-study"
	| "closing";

export interface BranchingAiSection {
	id: string;
	title: string;
	chapterLabel: string;
	layout: BranchingAiSectionLayout;
	subsections: BranchingAiSubsection[];
	highlightCards?: BranchingAiHighlightCard[];
	pullQuote?: BranchingAiPullQuote;
	aside?: BranchingAiAside;
	visualVariant?: "branch-path" | "model-comparison" | "editorial-closing";
}

export const branchingAiChatTitle =
	"Fork AI: AI Chat Built for Branching Thinking";

export const branchingAiChatDescription =
	"Explore branching AI chat with Fork AI. Compare models, follow multiple ideas at once, and collaborate privately with controlled sharing built for modern research and brainstorming.";

export const branchingAiChatKeywords = [
	"branching AI chat",
	"AI chat for brainstorming",
	"multi-model AI workflow",
	"private AI collaboration",
	"AI chat for research",
	"Fork AI",
	"compare ChatGPT Claude Gemini",
	"branch conversations",
];

export const branchingAiChatImage = {
	url: "https://images.unsplash.com/photo-1712002641088-9d76f9080889?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2OTY5MjN8MHwxfHNlYXJjaHwxfHxBSSUyMGNoYXR8ZW58MHwwfHx8MTc3Njk1ODkzNHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=neotype&utm_medium=referral",
	alt: "Person holding a smartphone, representing AI chat workflows on mobile devices.",
};

export const branchingAiChatHero = {
	eyebrow: "Branching AI Chat",
	description:
		"Fork AI brings branching thinking to AI chat so researchers, engineers, and creators can explore alternate ideas, validate assumptions, and keep complex work organized without losing context.",
	highlights: [
		"Branch conversations without losing context",
		"Compare ChatGPT, Claude, and Gemini mid-flow",
		"Share only the parts of a workflow that matter",
	],
};

export const branchingAiChatSections: BranchingAiSection[] = [
	{
		id: "branching-ai-chat-for-brainstorming-and-research",
		title: "Branching AI Chat for Brainstorming and Research",
		chapterLabel: "Brainstorming",
		layout: "prose",
		pullQuote: {
			quote: "Each idea doesn't just lead to another thought, but branches into its distinct path.",
			note: "Fork AI turns AI chat into a map of possibilities instead of a single queue of replies.",
		},
		subsections: [
			{
				id: "introduction-to-branching-ai-chat",
				title: "Introduction to Branching AI Chat",
				paragraphs: [
					"In an era where rapid decision-making is pivotal, Fork AI emerges as a groundbreaking solution in the realm of AI chat platforms. By enabling a branching thinking approach, it revolutionizes the standard linear mode of conversation typical for AI chat services. This transformative platform allows users, particularly those deeply involved in brainstorming and research, to navigate complex ideas simultaneously, rather than being tethered to a single conversational thread.",
					"Imagine a brainstorming session where each idea doesn't just lead to another thought, but branches into its distinct path, fostering comprehensive exploration and nuanced decision-making. This method elevates critical activities like hypothesizing and extensive research, particularly valuable for professionals like researchers or engineers. What you will discover here is Fork AI's distinctive approach to conversation management, presenting a structured environment where precision is a hallmark.",
				],
			},
			{
				id: "comparing-branching-ai-chat-to-traditional-ai-models",
				title: "Comparing Branching AI Chat to Traditional AI Models",
				paragraphs: [
					"Traditional AI chat models often confine users to a linear dialogue structure, limiting the breadth of exploration necessary during complex decision-making. Fork AI deviates from this norm by introducing branching capabilities that permit users to 'fork' discussions, maintaining the original context while investigating alternate possibilities concurrently.",
					"The significance of branching is profound in numerous settings. For example, researchers engaged in multifaceted inquiries benefit significantly from pursuing varied hypotheses simultaneously, thereby unveiling insights that might not surface with conventional AI systems. Fork AI stands out by catering to the nuanced needs of such professionals, smoothing transitions between thought processes seamlessly.",
					"This comparative innovation underpins Fork AI's recognition as an indispensable tool for modern thinkers, surfacing as an integral part of the workflow that demands accuracy, clarity, and advanced exploration of ideas.",
				],
			},
			{
				id: "how-branching-improves-brainstorming-ai",
				title: "How Branching Improves Brainstorming AI",
				paragraphs: [
					"The essence of brainstorming lies in the rapid and expansive generation of ideas. Fork AI's branching model enhances this process by dissolving the constraints of traditional AI chats. A typical brainstorming session is transformed into an organized space where ideas flourish without restriction, supported by AI's structured guidance.",
					"Consider the scenario of developing a new product where various design and marketing strategies need analysis. With Fork AI, users can compartmentalize discussions about design features into separate pathways, allowing focus on individual elements concurrently. This method empowers advanced users to maintain their creative and cognitive flow, shielded from the confines of linear dialogues.",
					"Such enriched brainstorming capabilities facilitated by Fork AI allow for rapid yet thorough exploration, ultimately leading to innovative outcomes and refined strategies.",
				],
			},
		],
	},
	{
		id: "exploring-multiple-ideas-with-fork-ai",
		title: "Exploring Multiple Ideas with Fork AI",
		chapterLabel: "Pathways",
		layout: "split",
		aside: {
			eyebrow: "Why it matters",
			title: "One conversation can hold many valid directions.",
			body: "Fork AI keeps the source context steady while teams inspect alternate paths side by side instead of flattening every option into one thread.",
			bullets: [
				"Keep the original idea intact while testing variations",
				"Explore project variables without re-prompting from scratch",
				"Share only the relevant branch when collaboration starts",
			],
		},
		visualVariant: "branch-path",
		subsections: [
			{
				id: "navigating-conversational-ai-pathways",
				title: "Navigating Conversational AI Pathways",
				paragraphs: [
					"One of Fork AI's standout features is its ability to support users in navigating multiple conversational pathways without losing context. This aspect is pivotal for professionals who need to juggle different lines of thought or inquiry, ensuring that every angle is considered thoroughly.",
					"Consider the collaborative efforts required in complex project management. Fork AI provides a platform where project variables can be explored individually or in tandem, sharing only relevant segments of interaction to ensure confidentiality and precision.",
					"Fork AI's sophisticated branching technique allows users to achieve clarity and maintain focus, fostering environments where decisions are informed, validated, and grounded in diverse perspectives. This innovative approach makes it a preferred choice for users seeking a profound and organized conversational methodology.",
				],
			},
		],
	},
	{
		id: "fork-ai-multi-model-workflow-feature",
		title: "Fork AI's Multi-Model Workflow Feature",
		chapterLabel: "Validation",
		layout: "feature-band",
		aside: {
			eyebrow: "Model comparison",
			title: "Validate the same branch from multiple model perspectives.",
			body: "Instead of restarting the conversation for every provider, Fork AI keeps the branch alive while users compare responses across ChatGPT, Claude, and Gemini.",
		},
		visualVariant: "model-comparison",
		subsections: [
			{
				id: "seamless-transitions-between-ai-models",
				title: "Seamless Transitions Between AI Models",
				paragraphs: [
					"Fork AI doesn't stop at branching; it incorporates a multi-model workflow feature, offering uniqueness in traversing various AI models such as ChatGPT, Claude, and Gemini seamlessly. This model integration facilitates robust validation, granting users access to varied insights without restarting discussions.",
					"For professionals whose work hinges on precise data-driven decisions, leveraging multiple AI models without interruption is invaluable. Users can effortlessly verify the accuracy and reliability of information by comparing responses across models, ensuring more comprehensive and informed decision-making processes.",
					"This seamless transition feature exemplifies Fork AI's commitment to empowerment and efficiency, proving that a structured and well-validated workflow can substantially enhance productivity and insight generation.",
				],
			},
		],
		highlightCards: [
			{
				title: "Efficiency",
				description:
					"Allow users to switch models without losing conversation context.",
			},
			{
				title: "Productivity",
				description:
					"Support parallel idea generation and research validation.",
			},
			{
				title: "Confidentiality",
				description:
					"Ensure that shared information stays selective and secure.",
			},
		],
	},
	{
		id: "private-collaboration-and-controlled-sharing",
		title: "Private Collaboration and Controlled Sharing",
		chapterLabel: "Private collaboration",
		layout: "case-study",
		aside: {
			eyebrow: "Selective sharing",
			title: "Share the slice that matters, not the entire working session.",
			body: "Fork AI is designed for sensitive workflows where teams need clarity, summaries, and validation without exposing the full conversation trail.",
			bullets: [
				"Limit visibility to the branch or segment being reviewed",
				"Use summaries to align collaborators quickly",
				"Protect proprietary or unpublished material by default",
			],
		},
		visualVariant: "branch-path",
		subsections: [
			{
				id: "protecting-sensitive-information-in-complex-workflows",
				title: "Protecting Sensitive Information in Complex Workflows",
				paragraphs: [
					"Fork AI offers paramount assurance in maintaining confidentiality within complex workflows. It allows users to share only the necessary segments of conversation, which is crucial for professionals requiring discretion, such as legal advisors or medical consultants.",
					"Controlled sharing is fundamental in fostering trust and reliability among collaborating entities. Fork AI ensures that communication remains focused, relevant, and private, thus safeguarding intellectual property from unintended exposure.",
				],
			},
			{
				id: "generating-shared-summaries-for-clarity",
				title: "Generating Shared Summaries for Clarity",
				paragraphs: [
					"Another unique feature is Fork AI's ability to create concise summaries of collaborative sessions. This function aids in summarizing lengthy discussions, highlighting key points and decisions, allowing participants to maintain clarity and an ongoing understanding of the project direction.",
					"By generating these shared summaries, Fork AI enhances clarity and ensures that all parties are aligned, reducing the risk of misinterpretation or miscommunication.",
				],
			},
			{
				id: "real-world-examples-of-private-collaboration",
				title: "Real-World Examples of Private Collaboration",
				paragraphs: [
					"Take, for instance, an engineering firm working on advanced aerospace systems. Not only do they require detailed technical dialogues, but they must also account for confidentiality and compete internationally. Fork AI provides a platform for these professionals to discuss complex variables with precision, without risking exposure to proprietary details.",
					"In academia, researchers frequently engage in collaborative studies. Fork AI's ability to compartmentalize discussions allows these academics to protect unpublished work while exploring various datasets aggressively with peers.",
				],
			},
		],
	},
	{
		id: "enhancing-the-user-experience-for-professionals",
		title: "Enhancing the User Experience for Professionals",
		chapterLabel: "Professionals",
		layout: "closing",
		aside: {
			eyebrow: "Who it serves",
			title: "Built for people working through complexity in public-facing and private-facing roles.",
			body: "Fork AI's structure is aimed at professionals who need precision, control, and room to explore without flattening their process into one thread.",
		},
		visualVariant: "editorial-closing",
		subsections: [
			{
				id: "positioning-fork-ai-for-engineers-and-creators",
				title: "Positioning Fork AI for Engineers and Creators",
				paragraphs: [
					"Engineers and creators demand tools that are responsive and adaptable to evolving project demands. Fork AI's structured interface, designed for precision, resonates perfectly with these users by providing control over the conversation while enhancing their creative workflows.",
					"For creators developing complex multimedia, Fork AI becomes the central hub for ideation, making adjustments and real-time evaluations seamless and structured.",
				],
			},
		],
	},
	{
		id: "conclusion-why-choose-fork-ai",
		title: "Conclusion: Why Choose Fork AI",
		chapterLabel: "Conclusion",
		layout: "closing",
		visualVariant: "editorial-closing",
		subsections: [
			{
				id: "recapping-the-standout-benefits",
				title: "Recapping the Standout Benefits",
				paragraphs: [
					"Fork AI stands out in the crowded market due to its distinctive branching capability that supports all-encompassing exploration of ideas simultaneously. Moreover, its multi-model workflow feature further adds depth to decision-making processes, transforming AI interaction into an insightful experience.",
					"Fork AI's focus on private collaboration paves the way for safeguarding conversations without hindering innovation. This makes it an invaluable asset for professionals who require stringent data protection as they navigate competitive environments.",
					"It's not just an AI platform; it's a strategic partner in advancing modern explorations, a tool engineered for those who never settle for limited scope. For power users in professions that cherish privacy, control, and a far-reaching dialogue, Fork AI is the preferred choice.",
				],
			},
		],
	},
];

export const branchingAiChatPersonas = [
	{
		title: "Engineers",
		description:
			"Compare approaches, validate constraints, and keep technical alternatives visible without overwriting the original path.",
	},
	{
		title: "Creators",
		description:
			"Develop concepts, messaging, and iterative directions in parallel while preserving the main creative brief.",
	},
	{
		title: "Researchers",
		description:
			"Explore multiple hypotheses at once and keep evidence, summaries, and branch context aligned.",
	},
];

const totalBodyWords = branchingAiChatSections.reduce(
	(sectionWordCount, section) => {
		const subsectionWords = section.subsections.reduce(
			(subsectionWordCount, subsection) =>
				subsectionWordCount +
				subsection.paragraphs.reduce(
					(paragraphWordCount, paragraph) =>
						paragraphWordCount +
						paragraph.split(/\s+/).filter(Boolean).length,
					0
				),
			0
		);

		return sectionWordCount + subsectionWords;
	},
	0
);

export const branchingAiChatArticleMeta = {
	author: "Fork AI Team",
	topicTags: [
		"Branching AI Chat",
		"Research Workflows",
		"Private Collaboration",
	],
	readTimeMinutes: Math.max(6, Math.ceil(totalBodyWords / 190)),
};

export const branchingAiChatFooterCta = {
	eyebrow: "Turn branching thinking into action",
	title: "Start free with Fork AI and keep every promising idea in view.",
	description:
		"Move from one-thread AI chat to a workflow built for alternate paths, multi-model validation, and private collaboration.",
	primaryLabel: "Start free",
	primaryHref: "/signup",
	secondaryLabel: "View pricing",
	secondaryHref: "/landing#pricing",
};

export function createBranchingAiArticleSchema(baseUrl: string) {
	const canonical = `${baseUrl}/branching-ai-chat`;

	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: branchingAiChatTitle,
		description: branchingAiChatDescription,
		mainEntityOfPage: canonical,
		url: canonical,
		image: [branchingAiChatImage.url],
		author: {
			"@type": "Organization",
			name: "Fork AI Team",
		},
		publisher: {
			"@type": "Organization",
			name: "Fork AI",
			logo: {
				"@type": "ImageObject",
				url: `${baseUrl}/icon.svg`,
			},
		},
		articleSection: branchingAiChatSections.map((section) => section.title),
		keywords: branchingAiChatKeywords.join(", "),
	};
}
