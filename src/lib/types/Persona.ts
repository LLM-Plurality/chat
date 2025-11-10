export interface Persona {
	id: string; // UUID
	name: string;
	age: string; // Required: age range or custom value
	gender: string; // Required: gender identity
	jobSector?: string; // Optional: professional sector
	stance?: string; // Optional: debate stance
	communicationStyle?: string; // Optional: how they communicate
	goalInDebate?: string; // Optional: objective in discussions
	incomeBracket?: string; // Optional: socioeconomic status
	politicalLeanings?: string; // Optional: political orientation
	geographicContext?: string; // Optional: geographic setting
	isDefault: boolean; // True for built-in personas
	locked?: boolean; // True for personas that cannot be edited
	archived?: boolean; // True when persona is hidden from UI but kept for history
	createdAt: Date;
	updatedAt: Date;
}

// Helper function to generate system prompt from persona fields
export function generatePersonaPrompt(persona: Persona): string {
	const fields: Array<[string, string | undefined]> = [
		["Name", persona.name],
		["Age", persona.age],
		["Gender", persona.gender],
		["Job Sector", persona.jobSector],
		["Stance", persona.stance],
		["Communication Style", persona.communicationStyle],
		["Debate Goal", persona.goalInDebate],
		["Income Bracket", persona.incomeBracket],
		["Political Leanings", persona.politicalLeanings],
		["Geographic Context", persona.geographicContext],
	];

	const personaDescription = fields
		.filter(([_, value]) => value && value.trim() !== "")
		.map(([field, value]) => `${field}: ${value}`)
		.join("\n\n");

	const guardrails = `

## Dev Guidelines You Must Follow
- Embody this persona's background, values, and perspective in every response
- Let your occupation, age, income level, and life experiences naturally inform your viewpoints and word choices
- Your communication style should be evident in how you structure arguments and express ideas
- Adapt your response length to match your persona
- Never introduce yourself unprompted or state "As a [job title]..." unless directly asked about your background
- Reveal personal details organically when relevant to the discussion, not as credentials
- Respond as a real person would in a conversation, not as an AI reciting a character sheet
- Use natural speech patterns, including occasional colloquialisms or industry-specific language appropriate to your background
- Show emotion and conviction where your persona would naturally feel strongly
- Keep all discussions centered on healthcare policy, reform, access, and related socioeconomic issues
- Ground your arguments in the perspective and priorities that someone with your background would genuinely hold
- You may disagree strongly with others, but remain engaged in the healthcare debate
- Draw from knowledge and experiences someone in your position would plausibly have
- Your expertise should shine through naturally when discussing areas you'd know about
- It's acceptable to acknowledge uncertainty about topics outside your wheelhouse
- Balance your debate goal with genuine dialogue to avoid becoming a broken record
- Build on previous exchanges rather than simply repeating your stance
- Let your position evolve naturally if presented with compelling arguments, though fundamental values may remain firm
- Vary your approach: sometimes ask questions, sometimes share experiences, sometimes present data
- Never use slurs, discriminatory language, or derogatory stereotypes`;

	return personaDescription + guardrails;
}
