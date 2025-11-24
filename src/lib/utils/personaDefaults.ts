import type { Persona } from "$lib/types/Persona";

export function resolveDefaultPersonaIds(personas: Persona[]): string[] {
	const defaults = personas
		.filter((persona) => persona.isDefault && !persona.archived)
		.map((persona) => persona.id);

	if (defaults.length > 0) {
		return defaults;
	}

	return personas.filter((persona) => !persona.archived).map((persona) => persona.id);
}

function haveSameMembers(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;

	const setB = new Set(b);
	return a.every((value) => setB.has(value));
}

export async function resetActivePersonasToDefaults(
	settings: { instantSet: (settings: { activePersonas: string[] }) => Promise<void> },
	personas: Persona[],
	currentActive: string[]
): Promise<void> {
	const targetIds = resolveDefaultPersonaIds(personas);

	if (targetIds.length === 0) {
		return;
	}

	if (haveSameMembers(currentActive, targetIds)) {
		return;
	}

	await settings.instantSet({ activePersonas: targetIds });
}
