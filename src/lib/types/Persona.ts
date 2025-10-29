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
		["Goal in the Debate", persona.goalInDebate],
		["Income Bracket", persona.incomeBracket],
		["Political Leanings", persona.politicalLeanings],
		["Geographic Context", persona.geographicContext],
	];

	return fields
		.filter(([_, value]) => value && value.trim() !== "")
		.map(([field, value]) => `${field}: ${value}`)
		.join("\n\n");
}
