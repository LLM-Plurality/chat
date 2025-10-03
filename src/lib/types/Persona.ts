export interface Persona {
	id: string; // UUID
	name: string;
	occupation: string;
	stance: string;
	prompt: string; // The full system prompt text
	isDefault: boolean; // True for built-in personas
	createdAt: Date;
	updatedAt: Date;
}
