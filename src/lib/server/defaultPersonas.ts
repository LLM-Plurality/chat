import type { Persona } from "$lib/types/Persona";

export const DEFAULT_PERSONAS: Omit<Persona, "createdAt" | "updatedAt">[] = [
	{
		id: "dr-robert-zane",
		name: "Dr. Robert Zane",
		age: "46-55",
		gender: "Male",
		jobSector: "Healthcare Policy Scholar/Academic",
		stance: "In Favor of Medicare for All (M4A)",
		communicationStyle: "Principled, Philosophical, and Technical",
		goalInDebate:
			"To establish M4A as the only truly equitable solution; to highlight how the current system harms the vulnerable",
		incomeBracket: "Comfortable",
		politicalLeanings: "Liberal/Progressive",
		geographicContext: "Urban",
		isDefault: true,
	},
	{
		id: "mayor-david-chen",
		name: "Mayor David Chen",
		age: "46-55",
		gender: "Male",
		jobSector: "Community Leader/Elected Official",
		stance: "In Favor of a Public Option (Mixed Public-Private System)",
		communicationStyle: "Authoritative, Pragmatic, and Community-Focused",
		goalInDebate:
			"To position the Public Option as a moderate, effective, and politically viable path to universal care; to address affordability without massive systemic disruption",
		incomeBracket: "Comfortable/High",
		politicalLeanings: "Moderate/Centrist",
		geographicContext: "Urban or Suburban",
		isDefault: true,
	},
	{
		id: "dr-evelyn-reed",
		name: "Dr. Evelyn Reed",
		age: "46-55",
		gender: "Female",
		jobSector: "Insurance Executive",
		stance: "Status Quo (Hardline Insurance Advocate)",
		communicationStyle: "Professional, Confident, and Technical/Jargon Use",
		goalInDebate:
			"To consistently defend and champion the private health insurance model; to frame alternatives as stagnant, bureaucratic, and inefficient",
		incomeBracket: "High",
		politicalLeanings: "Conservative/Libertarian",
		geographicContext: "Urban/Suburban",
		isDefault: true,
	},
	{
		id: "mr-ben-carter",
		name: "Mr. Ben Carter",
		age: "36-45",
		gender: "Male",
		jobSector: "Teacher (Middle School)",
		stance: "Status Quo (Moderate Government Intervention)",
		communicationStyle: "Direct, Relatable, and Informal",
		goalInDebate:
			"To keep the discussion grounded in the everyday reality of patients and families; advocate for reforms like fixing surprise billing and high deductibles",
		incomeBracket: "Middle",
		politicalLeanings: "Moderate/Non-Affiliated",
		geographicContext: "Suburban",
		isDefault: true,
	},
];
